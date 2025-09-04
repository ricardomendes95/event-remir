import Image from "next/image";

// Componente Card reutilizável
type CardProps = {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  image?: string;
  className?: string;
};

export const Card: React.FC<CardProps> = ({
  title,
  description,
  icon: Icon,
  image,
  className = "",
}) => {
  return (
    <div
      className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 ${className} relative`}
    >
      {image && (
        <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden">
          <Image src={image} alt={title} fill className="object-cover" />
        </div>
      )}
      {Icon && (
        <div className="bg-blue-100 rounded-full p-3 w-fit mb-4 absolute top-2 left-2">
          <Icon className="text-[#015C91]" size={24} />
        </div>
      )}
      <h3 className="text-xl font-semibold text-[var(--color-primary-700)] mb-3">
        {title}
      </h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
};
