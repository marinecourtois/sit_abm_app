"""Modèle agent-based TIS — extrait du notebook `Notebook_ABM_TIS_Optimise_Modelly.ipynb`.

Les cellules 2 (cultures), 3 (durées de vie), 3 (agents) et 4 (RematingModel) sont reprises
à l'identique : mêmes équations, mêmes tirages, dans le même ordre. Les seules différences
sont marquées « APP » et ne changent aucun nombre quand les valeurs par défaut sont utilisées
(vérifié par tests/test_regression.py contre les sorties enregistrées du notebook) :

  APP 1 : les durées de vie moyennes / CV sont portées par le modèle (au lieu de globals du
          module), pour qu'une expérience puisse les modifier sans effet de bord entre runs.
  APP 2 : eta (compétitivité des stériles, 0.8) et eta_sperm_choice (0.59) sont lus sur le
          modèle (mêmes valeurs par défaut que les constantes de Females_Agent).
  APP 3 : compteurs cumulés de pontes fertiles / stériles (lecture seule, aucun tirage),
          pour l'indicateur « proportion de piqûres non viables ».
"""
from __future__ import annotations

import math
from dataclasses import dataclass, asdict

import modelly

ENGINE_VERSION = "1.0.0"          # version de l'extraction (ce module)
NOTEBOOK_REFERENCE = "Notebook_ABM_TIS_Optimise_Modelly.ipynb"
ECHELLE = 30


# ---------------------------------------------------------------- cultures (cellule 2)
@dataclass(frozen=True)
class CropParameters:
    name: str
    season_length: int
    total_fruits: int
    initial_fruits: int
    daily_fruit_production: int
    maturation_min: int
    maturation_max: int
    natural_lifespan_min: int
    natural_lifespan_max: int
    harvest_frequency: int
    prophylaxis_frequency: int

    def to_dict(self):
        return asdict(self)


STRAWBERRY = CropParameters(
    name="strawberry", season_length=100, total_fruits=3000 * ECHELLE, initial_fruits=0,
    daily_fruit_production=30 * ECHELLE, maturation_min=2, maturation_max=4,
    natural_lifespan_min=7, natural_lifespan_max=14, harvest_frequency=3, prophylaxis_frequency=3,
)
CHERRY = CropParameters(
    name="cherry", season_length=25, total_fruits=3000 * ECHELLE, initial_fruits=3000 * ECHELLE,
    daily_fruit_production=0, maturation_min=10, maturation_max=15,
    natural_lifespan_min=20, natural_lifespan_max=50, harvest_frequency=0, prophylaxis_frequency=0,
)
CROPS = {"strawberry": STRAWBERRY, "cherry": CHERRY}


# ---------------------------------------------------------------- durées de vie (cellule 3)
LIFESPAN_MEANS = {"sterile": 7.0, "wild": 25.0, "female": 25.0}
LIFESPAN_CV = {"sterile": 0.30, "wild": 0.30, "female": 0.30}


def sample_lifespan(group, rng, means=LIFESPAN_MEANS, cvs=LIFESPAN_CV):
    """Tire une durée de vie entière dans une loi normale tronquée à 1 jour."""
    if group not in means:
        raise ValueError(f"Groupe de durée de vie inconnu : {group}")
    mean = means[group]
    sd = mean * cvs[group]
    lifespan = rng.gauss(mean, sd)
    while lifespan < 1:
        lifespan = rng.gauss(mean, sd)
    return max(1, round(lifespan))


def _poisson(rng, lam):
    L = math.exp(-lam)
    k, p = 0, 1.0
    while True:
        p *= rng.random()
        if p <= L:
            return k
        k += 1


# ---------------------------------------------------------------- agents (cellule 3)
class SterileMales_Agent(modelly.Agent):
    def __init__(self, model):
        super().__init__(model)
        self.creation_date = model.time
        rng = model.random
        total_lifespan = sample_lifespan("sterile", rng, model.lifespan_means, model.lifespan_cv)  # APP 1
        initial_age = rng.randint(0, total_lifespan - 1) if model.time == 0 else 0
        self.death_date = model.time + (total_lifespan - initial_age)
        model.pop_sterile_males += 1

    def step(self):
        if self.model.time >= self.death_date:
            self.remove()
            self.model.pop_sterile_males = max(0, self.model.pop_sterile_males - 1)


class WildMales_Agent(modelly.Agent):
    def __init__(self, model):
        super().__init__(model)
        self.creation_date = model.time
        rng = model.random
        total_lifespan = sample_lifespan("wild", rng, model.lifespan_means, model.lifespan_cv)  # APP 1
        initial_age = rng.randint(0, total_lifespan - 1) if model.time == 0 else 0
        self.death_date = model.time + (total_lifespan - initial_age)
        model.pop_wild_males += 1

    def step(self):
        if self.model.time >= self.death_date:
            self.remove()
            self.model.pop_wild_males = max(0, self.model.pop_wild_males - 1)


class Larvae_Agent(modelly.Agent):
    def __init__(self, model, sperm_selection, fruit=None):
        super().__init__(model)
        self.creation_date = model.time
        self.sperm_selection = sperm_selection
        self.fruit = fruit
        self.sex_ratio = 0.5
        self.in_fruit = False
        self.death_date = self.mortality()
        self.emergence_date = model.time + model.random.randint(6, 11)
        model.pop_larvae += 1
        model.cumulative_larvae_born += 1

    def mortality(self):
        r, t = self.model.random, self.model.time
        if r.random() < 0.132: return t + 1
        if r.random() < 0.087: return t + 2
        if r.random() < 0.048: return t + 3
        if r.random() < 0.100: return t + r.randint(4, 5)
        if r.random() < 0.056: return t + r.randint(7, 11)
        return None

    def kill(self):
        if self in self.model.agents:
            self.remove()
            self.model.pop_larvae = max(0, self.model.pop_larvae - 1)
            fruit = self.fruit
            if self.in_fruit and fruit is not None:
                fruit.n_alive_fertile -= 1
                fruit.sum_creation -= self.creation_date
        self.fruit = None

    def step(self):
        if self.death_date is not None and self.model.time >= self.death_date:
            self.kill()
            return
        if self.model.time >= self.emergence_date:
            self.kill()
            if self.model.random.random() < self.sex_ratio:
                WildMales_Agent(self.model)
            else:
                Females_Agent(self.model, self.sperm_selection, initial_mating_status="unmated")


class Females_Agent(modelly.Agent):
    def __init__(self, model, sperm_selection, initial_mating_status="unmated"):
        super().__init__(model)
        self.creation_date = model.time
        rng = model.random
        total_lifespan = sample_lifespan("female", rng, model.lifespan_means, model.lifespan_cv)  # APP 1
        initial_age = rng.randint(0, total_lifespan - 1) if model.time == 0 else 0
        self.death_date = model.time + (total_lifespan - initial_age)

        self.time_until_next_mating = 0
        if initial_mating_status == "fertile":
            self.fertile_matings, self.sterile_matings = 1, 0
            self.first_mating, self.last_mating = 1, 1
        else:
            self.fertile_matings, self.sterile_matings = 0, 0
            self.first_mating, self.last_mating = None, None
        self.eggs_laid = 0
        # APP 2 : 0.8 / 0.59 / 6 dans le notebook ; lus sur le modèle (mêmes défauts)
        self.eta, self.eta_sperm_choice, self.mean_eggs_per_day = model.eta, model.eta_sperm_choice, 6
        self.RF_fertilized_min, self.RF_fertilized_max = 3, 13
        self.RF_sterilized_min, self.RF_sterilized_max = 4, 11
        self.sperm_selection = sperm_selection
        model.pop_females += 1

    def use_fertile_sperm(self):
        if self.fertile_matings == 0: return False
        if self.sperm_selection == "first": return self.first_mating == 1
        if self.sperm_selection == "last": return self.last_mating == 1
        rng = self.model.random
        if self.sperm_selection in ("mixed", "choice"):
            total = self.fertile_matings + self.sterile_matings
            return False if total == 0 else rng.random() < self.fertile_matings / total
        denom = self.fertile_matings + self.eta_sperm_choice * self.sterile_matings
        return False if denom == 0 else rng.random() < self.fertile_matings / denom

    def egglaying(self):
        rng = self.model.random
        number_eggs_laid = min(_poisson(rng, self.mean_eggs_per_day), 6)
        if number_eggs_laid <= 0: return
        pool = self.model.fruits_with_space
        if not pool: return
        n_fruits = min(rng.randint(1, 6), number_eggs_laid, len(pool))
        selected_fruits = rng.sample(pool, n_fruits)
        eggs_per_fruit = [1] * n_fruits
        for _ in range(number_eggs_laid - n_fruits):
            avail = [j for j, f in enumerate(selected_fruits) if len(f.slots) < f.capacity]
            if not avail: break
            eggs_per_fruit[rng.choice(avail)] += 1

        for fruit, n_eggs in zip(selected_fruits, eggs_per_fruit):
            for _ in range(n_eggs):
                if not fruit.can_receive_oviposition(): continue
                if self.use_fertile_sperm():
                    larva = Larvae_Agent(self.model, self.sperm_selection, fruit=fruit)
                    if fruit.add_oviposition("fertile", larva=larva): self.eggs_laid += 1
                    else: larva.kill()
                else:
                    if fruit.add_oviposition("sterile", larva=None): self.eggs_laid += 1

    def step(self):
        if self.model.time >= self.death_date:
            self.remove()
            self.model.pop_females = max(0, self.model.pop_females - 1)
            return
        rng = self.model.random
        if self.time_until_next_mating == 0:
            denom = self.model.pop_wild_males + self.eta * self.model.pop_sterile_males
            if denom > 0:
                if rng.random() < self.model.pop_wild_males / denom:
                    self.fertile_matings += 1
                    self.last_mating = 1
                    if self.first_mating is None: self.first_mating = 1
                    self.time_until_next_mating = rng.randint(self.RF_fertilized_min, self.RF_fertilized_max - 1)
                else:
                    self.sterile_matings += 1
                    self.last_mating = 0
                    if self.first_mating is None: self.first_mating = 0
                    self.time_until_next_mating = rng.randint(self.RF_sterilized_min, self.RF_sterilized_max - 1)
        else:
            self.time_until_next_mating -= 1
        self.egglaying()


class Fruit_Agent:
    def __init__(
        self, model, crop_parameters, capacity=20,
        young_puncture_probability=0.30, rotten_puncture_probability=0.10,
        rotten_threshold=5.0, larva_age_weight=0.5,
        rot_hazard_control=0.0, rot_hazard_sterile=0.2310, rot_hazard_fertile=0.3054,
    ):
        self.unique_id = model.next_fruit_id()
        self.model = model
        self.crop, self.capacity = crop_parameters.name, capacity
        self.young_puncture_probability = young_puncture_probability
        self.rotten_puncture_probability = rotten_puncture_probability
        self.rotten_threshold, self.larva_age_weight = rotten_threshold, larva_age_weight
        self.rot_hazard_control = rot_hazard_control
        self.rot_hazard_sterile = rot_hazard_sterile
        self.rot_hazard_fertile = rot_hazard_fertile
        self.creation_date = model.time
        self.first_oviposition_date = None
        rng = model.random
        self.maturation_age = rng.randint(crop_parameters.maturation_min, crop_parameters.maturation_max)
        self.natural_lifespan = rng.randint(crop_parameters.natural_lifespan_min, crop_parameters.natural_lifespan_max)
        self.slots = []
        self.n_fertile = 0
        self.n_sterile = 0
        self.n_alive_fertile = 0
        self.sum_creation = 0
        self.status = "young"
        self.removed = False
        model.fruits.append(self)
        model.fruits_with_space.append(self)

    @property
    def age(self): return self.model.time - self.creation_date

    @property
    def occupied(self): return len(self.slots)

    def has_space(self):
        return len(self.slots) < self.capacity

    def can_receive_oviposition(self):
        if not self.has_space(): return False
        rng = self.model.random
        if self.status == "young": return rng.random() < self.young_puncture_probability
        if self.status == "rotten": return rng.random() < self.rotten_puncture_probability
        return self.status == "harvestable"

    def add_oviposition(self, oviposition_type, larva=None):
        if not self.has_space(): return False
        if self.unique_id in self.model.rotten_fruit_ids:
            if oviposition_type == "fertile" and self.n_fertile == 0:
                if self.n_sterile > 0: self.model.cumulative_rotten_sterile_only -= 1
                else: self.model.cumulative_rotten_clean -= 1
                self.model.cumulative_rotten_with_larvae += 1
            elif oviposition_type == "sterile" and self.n_fertile == 0 and self.n_sterile == 0:
                self.model.cumulative_rotten_clean -= 1
                self.model.cumulative_rotten_sterile_only += 1

        self.slots.append({"type": oviposition_type, "larva": larva})
        if oviposition_type == "fertile":
            self.n_fertile += 1
            self.n_alive_fertile += 1
            self.sum_creation += larva.creation_date
            larva.in_fruit = True
            self.model.cumulative_fertile_ovipositions += 1   # APP 3
        else:
            self.n_sterile += 1
            self.model.cumulative_sterile_ovipositions += 1   # APP 3
        if self.first_oviposition_date is None: self.first_oviposition_date = self.model.time
        if not self.has_space():
            self.model.fruits_with_space.remove(self)
        return True

    def check_status(self):
        if self.status == "rotten": return
        age = self.model.time - self.creation_date
        natural = age >= self.natural_lifespan
        hz = self.rot_hazard_fertile if self.n_fertile > 0 else (self.rot_hazard_sterile if self.n_sterile > 0 else 0.0)
        treatment = self.first_oviposition_date is not None and self.model.random.random() < (1.0 - math.exp(-hz))
        n = self.n_alive_fertile
        if n:
            rotten_score = n + self.larva_age_weight * (n * self.model.time - self.sum_creation)
            infest = rotten_score >= self.rotten_threshold
        else:
            infest = False

        if natural or treatment or infest:
            self.status = "rotten"
            if self.unique_id not in self.model.rotten_fruit_ids:
                self.model.rotten_fruit_ids.add(self.unique_id)
                self.model.cumulative_rotten_fruits += 1
                if self.n_fertile > 0:
                    self.model.cumulative_rotten_with_larvae += 1
                elif self.n_sterile > 0:
                    self.model.cumulative_rotten_sterile_only += 1
                else:
                    self.model.cumulative_rotten_clean += 1
            return
        self.status = "harvestable" if age >= self.maturation_age else "young"

    def remove_from_model(self):
        for s in self.slots:
            if s["type"] == "fertile" and s["larva"] is not None: s["larva"].kill()
        self.removed = True
        self.model.fruits_removed = True


# ---------------------------------------------------------------- modèle (cellule 4)
class RematingModel(modelly.Model):
    def __init__(
        self, crop_parameters, num_agents_sterile=0, num_agents_wild=10, num_agents_larvae=0, num_agents_females=10,
        sperm_selection="preference", sterile_release_schedule=None,
        initial_female_mating_status="unmated", female_releases=None, female_release_mating_status="fertile",
        fruit_capacity=20, young_puncture_probability=0.30, rotten_puncture_probability=0.10,
        rotten_threshold=5.0, larva_age_weight=0.5,
        rot_hazard_control=0.0, rot_hazard_sterile=0.2310, rot_hazard_fertile=0.3054,
        harvest_fraction=0.90, prophylaxis_fraction=0.60, seed=None,
        # APP 1 / APP 2 (défauts = constantes du notebook)
        lifespan_means=None, lifespan_cv=None, eta=0.8, eta_sperm_choice=0.59,
    ):
        super().__init__(rng=seed)
        self.random = modelly.FastRandom(seed)
        self.lifespan_means = dict(LIFESPAN_MEANS if lifespan_means is None else lifespan_means)
        self.lifespan_cv = dict(LIFESPAN_CV if lifespan_cv is None else lifespan_cv)
        self.eta, self.eta_sperm_choice = eta, eta_sperm_choice
        self.cumulative_fertile_ovipositions = 0   # APP 3
        self.cumulative_sterile_ovipositions = 0   # APP 3
        self._fruit_id_counter = 0
        self.time, self.crop, self.sperm_selection = 0, crop_parameters, sperm_selection
        self.pop_sterile_males, self.pop_wild_males, self.pop_females, self.pop_larvae = 0, 0, 0, 0
        self.cumulative_larvae_born = 0
        self.fruits = []
        self.fruits_with_space = []
        self.fruits_removed = False
        self.cumulative_harvested_fruits, self.cumulative_rotten_fruits, self.cumulative_prophylaxis_removed = 0, 0, 0
        self.cumulative_harvested_with_larvae, self.cumulative_harvested_sterile_only, self.cumulative_harvested_clean = 0, 0, 0
        self.cumulative_rotten_with_larvae = 0
        self.cumulative_rotten_sterile_only = 0
        self.cumulative_rotten_clean = 0
        self.rotten_fruit_ids = set()
        self.fruit_capacity = fruit_capacity
        self.young_puncture_probability, self.rotten_puncture_probability = young_puncture_probability, rotten_puncture_probability
        self.rotten_threshold, self.larva_age_weight = rotten_threshold, larva_age_weight
        self.rot_hazard_control, self.rot_hazard_sterile, self.rot_hazard_fertile = rot_hazard_control, rot_hazard_sterile, rot_hazard_fertile
        self.harvest_fraction, self.prophylaxis_fraction = harvest_fraction, prophylaxis_fraction
        self.sterile_release_schedule = sterile_release_schedule.copy() if sterile_release_schedule else {}
        self.total_sterile_released = 0
        self.female_releases = {int(k): int(v) for k, v in female_releases.items()} if isinstance(female_releases, dict) else {}
        self.female_release_mating_status = female_release_mating_status

        for _ in range(num_agents_sterile): SterileMales_Agent(self)
        for _ in range(num_agents_wild): WildMales_Agent(self)
        for _ in range(num_agents_larvae): Larvae_Agent(self, sperm_selection)
        for _ in range(num_agents_females): Females_Agent(self, sperm_selection, initial_mating_status=initial_female_mating_status)
        for _ in range(crop_parameters.initial_fruits): self.create_fruit()

        self.datacollector = modelly.DataCollector(
            model_reporters={
                "Time": lambda m: m.time,
                "Wild_males": lambda m: m.pop_wild_males,
                "Sterile_males": lambda m: m.pop_sterile_males,
                "Females": lambda m: m.pop_females,
                "Larvae": lambda m: m.pop_larvae,
                "Young_fruits": lambda m: m._census[0],
                "Harvestable_fruits": lambda m: m._census[1],
                "Rotten_natural": lambda m: m._census[2],
                "Rotten_sterile_only": lambda m: m._census[3],
                "Rotten_larvae": lambda m: m._census[4],
                "Harvested_cumul": lambda m: m.cumulative_harvested_fruits,
                "Rotten_cumul": lambda m: m.cumulative_rotten_fruits,
            }
        )
        self.collect_data()

    def next_fruit_id(self):
        uid = self._fruit_id_counter
        self._fruit_id_counter += 1
        return uid

    def create_fruit(self):
        return Fruit_Agent(
            self, self.crop, capacity=self.fruit_capacity,
            young_puncture_probability=self.young_puncture_probability,
            rotten_puncture_probability=self.rotten_puncture_probability,
            rotten_threshold=self.rotten_threshold, larva_age_weight=self.larva_age_weight,
            rot_hazard_control=self.rot_hazard_control, rot_hazard_sterile=self.rot_hazard_sterile,
            rot_hazard_fertile=self.rot_hazard_fertile,
        )

    def harvest(self, fraction=None):
        if fraction is None: fraction = self.harvest_fraction
        harvestable = [f for f in self.fruits if f.status == "harvestable"]
        if not harvestable: return 0
        n = int(fraction * len(harvestable))
        if n <= 0: return 0
        for f in self.random.sample(harvestable, n):
            if f.n_fertile > 0: self.cumulative_harvested_with_larvae += 1
            elif f.n_sterile > 0: self.cumulative_harvested_sterile_only += 1
            else: self.cumulative_harvested_clean += 1
            f.remove_from_model()
        self.cumulative_harvested_fruits += n
        return n

    def prophylaxis(self, fraction=None):
        if fraction is None: fraction = self.prophylaxis_fraction
        rotten = [f for f in self.fruits if f.status == "rotten"]
        if not rotten: return 0
        n = int(fraction * len(rotten))
        if n <= 0: return 0
        for f in self.random.sample(rotten, n): f.remove_from_model()
        self.cumulative_prophylaxis_removed += n
        return n

    def _fruit_census(self):
        young = ripe = rot_nat = rot_ster = rot_larv = 0
        for f in self.fruits:
            if   f.status == "young":       young += 1
            elif f.status == "harvestable": ripe += 1
            elif f.n_fertile > 0:           rot_larv += 1
            elif f.n_sterile > 0:           rot_ster += 1
            else:                           rot_nat += 1
        return young, ripe, rot_nat, rot_ster, rot_larv

    def remaining_on_plant(self):
        clean = sterile = larvae = 0
        for f in self.fruits:
            if f.removed or f.status == "rotten": continue
            if f.n_fertile > 0: larvae += 1
            elif f.n_sterile > 0: sterile += 1
            else: clean += 1
        return clean, sterile, larvae

    def collect_data(self):
        self._census = self._fruit_census()
        self.datacollector.collect(self)

    def advance_day(self):
        """Une journée (ex-`step()` Mesa, MODELLY 6 dans le notebook)."""
        if self.crop.daily_fruit_production > 0:
            for _ in range(self.crop.daily_fruit_production): self.create_fruit()
        n_ster = int(self.sterile_release_schedule.get(self.time, 0))
        for _ in range(n_ster): SterileMales_Agent(self)
        self.total_sterile_released += n_ster
        n_fem = int(self.female_releases.get(self.time, 0))
        for _ in range(n_fem): Females_Agent(self, self.sperm_selection, initial_mating_status=self.female_release_mating_status)

        agents = [a for bucket in self.agents_by_type.values() for a in bucket]
        self.random.shuffle(agents)
        for a in agents:
            if a in self.agents: a.step()

        for f in self.fruits: f.check_status()
        if self.crop.harvest_frequency > 0 and self.time > 0 and self.time % self.crop.harvest_frequency == 0: self.harvest()
        if self.crop.name == "cherry" and self.time == self.crop.season_length - 1: self.harvest()
        if self.crop.prophylaxis_frequency > 0 and self.time > 0 and self.time % self.crop.prophylaxis_frequency == 0: self.prophylaxis()

        if self.fruits_removed:
            self.fruits = [f for f in self.fruits if not f.removed]
            self.fruits_with_space = [f for f in self.fruits_with_space if not f.removed]
            self.fruits_removed = False

        self.time += 1
        self.collect_data()

    def get_model_dataframe(self):
        return self.datacollector.get_model_vars_dataframe()
