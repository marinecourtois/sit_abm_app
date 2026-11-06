"""Calendriers de lâchers TIS — cellule 5 du notebook, à l'identique."""


def continuous_schedule(budget, season_length):
    base, rem = budget // season_length, budget % season_length
    return {day: base + (1 if day < rem else 0) for day in range(season_length)}


def periodic_schedule(budget, season_length, interval, first_day=0):
    days = list(range(first_day, season_length, interval))
    base, rem = budget // len(days), budget % len(days)
    return {day: base + (1 if i < rem else 0) for i, day in enumerate(days)}


def front_loaded_schedule(budget, season_length, initial_fraction=0.70, maintenance_interval=7):
    if initial_fraction == 1.00: return {0: budget}
    init = int(round(budget * initial_fraction))
    rem = budget - init
    days = list(range(maintenance_interval, season_length, maintenance_interval))
    sched = {0: init}
    if rem > 0 and days:
        base, r = rem // len(days), rem % len(days)
        for i, d in enumerate(days): sched[d] = base + (1 if i < r else 0)
    elif rem > 0: sched[0] += rem
    return sched


def make_strategies(budget, season_length):
    if budget == 0:
        return {"No TIS": {}}
    return {
        "Daily": continuous_schedule(budget, season_length),
        "Every 3 days": periodic_schedule(budget, season_length, 3),
        "Every 7 days": periodic_schedule(budget, season_length, 7),
        "70% init + 7d maint": front_loaded_schedule(budget, season_length, 0.70, 7),
        "100% init": front_loaded_schedule(budget, season_length, 1.00, 0),
    }


STRAT_ORDER = ["No TIS", "Daily", "Every 3 days", "Every 7 days", "70% init + 7d maint", "100% init"]
