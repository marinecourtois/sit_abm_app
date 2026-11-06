import * as React from 'react';

export function SeedlingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Jeune pousse"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 27.5V15.5" />
      <path d="M16 19.5C15.6 15 12.4 12.2 7 12.4C7.2 17.4 10.6 19.8 16 19.5Z" />
      <path d="M16 15.5C16.2 10.6 19.6 7 25.4 6.8C25.6 12.4 22 15.6 16 15.5Z" />
      <path d="M16 15.5L21.2 10.8M16 19.5L11 15.6" strokeWidth={1} />
      <path d="M9.5 27.5H22.5" />
    </svg>
  );
}

export default SeedlingIcon;
