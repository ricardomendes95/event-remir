// Componente Button reutilizável
type ButtonProps = {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
  [key: string]: unknown;
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}) => {
  const baseClasses =
    "font-medium rounded-lg transition-all duration-300 inline-flex items-center justify-center";
  const variants = {
    primary:
      "bg-[#015C91] hover:bg-[#014B7A] text-white shadow-lg hover:shadow-xl",
    secondary:
      "bg-[#88CDF6] hover:bg-[#6BB9EB] text-white shadow-lg hover:shadow-xl",
    outline:
      "border-2 border-[#015C91] text-[#015C91] hover:bg-[#015C91] hover:text-white",
  };
  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className} cursor-pointer`}
      {...props}
    >
      {children}
    </button>
  );
};
