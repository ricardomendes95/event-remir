import { X, Menu } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { Container } from "./home/Container";

// Header Component
export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const menuItems = [
    { label: "Início", href: "#home" },
    { label: "Sobre", href: "#about" },
    { label: "Pastores", href: "#pastors" },
    { label: "Ministérios", href: "#ministries" },
    { label: "Eventos", href: "/eventos" },
    { label: "Localização", href: "#location" },
  ];

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-[var(--color-primary-100)] shadow-lg"
          : "bg-[var(--color-primary-100)]/90 backdrop-blur-sm"
      }`}
    >
      <Container>
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Image
                src="/logo.png"
                alt="Igreja Remir Logo"
                width={60}
                height={40}
              />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-[#015C91]">
                Igreja Remir
              </h1>
              <p className="text-xs text-gray-500 hidden lg:block">
                Chamados à liberdade
              </p>
            </div>
          </div>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center space-x-8">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-gray-700 hover:text-[#015C91] font-medium transition-colors duration-300 relative group"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#015C91] group-hover:w-full transition-all duration-300"></span>
              </a>
            ))}
          </nav>

          {/* CTA Button */}
          <div
            className="hidden lg:flex"
            onClick={() => (window.location.href = "#location")}
          >
            <Button variant="primary">Visite-nos</Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 text-gray-700 hover:text-[#015C91] transition-colors"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 w-full bg-white border-t shadow-lg">
            <nav className="py-4">
              {menuItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block px-4 py-3 text-gray-700 hover:text-[#015C91] hover:bg-blue-50 transition-colors duration-300"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <div className="px-4 py-3">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => (window.location.href = "#location")}
                >
                  Visite-nos
                </Button>
              </div>
            </nav>
          </div>
        )}
      </Container>
    </header>
  );
};
