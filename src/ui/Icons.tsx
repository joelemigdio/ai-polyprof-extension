interface IconProps {
  size?: number;
  className?: string;
}

function svgProps({ size = 16, className }: IconProps) {
  return {
    "aria-hidden": true,
    className: className ? `icon ${className}` : "icon",
    fill: "none",
    height: size,
    viewBox: "0 0 24 24",
    width: size,
    xmlns: "http://www.w3.org/2000/svg",
  } as const;
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.88l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.6z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PeerIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="9" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19.2c0-3.1 2.5-5.3 5.5-5.3s5.5 2.2 5.5 5.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17.6" cy="6.4" r="1.7" fill="currentColor" />
      <circle cx="20" cy="11.3" r="1.7" fill="currentColor" />
      <circle cx="16.4" cy="15.4" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 2.8l1.9 6.1 6.1 1.9-6.1 1.9-1.9 6.1-1.9-6.1L4 10.8l6.1-1.9L12 2.8z" fill="currentColor" />
      <path d="M18.6 16.1l.8 2.5 2.5.8-2.5.8-.8 2.5-.8-2.5-2.5-.8 2.5-.8.8-2.5z" fill="currentColor" />
    </svg>
  );
}

export function CloverIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="8.6" cy="8.6" r="4.4" fill="currentColor" />
      <circle cx="16" cy="7.6" r="3.6" fill="currentColor" />
      <circle cx="16.4" cy="15.2" r="4" fill="currentColor" />
      <circle cx="8.8" cy="15.8" r="3.8" fill="currentColor" />
    </svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.6l1.5 2.2 2.6-.5.5 2.6 2.4 1.1-1.1 2.4 1.7 2-1.7 2 1.1 2.4-2.4 1.1-.5 2.6-2.6-.5L12 21.4l-1.5-2.2-2.6.5-.5-2.6-2.4-1.1 1.1-2.4-1.7-2 1.7-2-1.1-2.4 2.4-1.1.5-2.6 2.6.5L12 2.6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="11" cy="11" r="6.4" stroke="currentColor" strokeWidth="2" />
      <path d="M15.8 15.8L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ClearIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.4 9.4l5.2 5.2M14.6 9.4l-5.2 5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M6.5 9.5l5.5 5.5 5.5-5.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.4V12l3 1.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BulbIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M9.3 17.2a5.6 5.6 0 115.4 0v1.6a1.4 1.4 0 01-1.4 1.4h-2.6a1.4 1.4 0 01-1.4-1.4v-1.6z" fill="currentColor" />
      <path d="M10.2 21.6h3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M19 12H5.5M11 5.5L4.5 12l6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
