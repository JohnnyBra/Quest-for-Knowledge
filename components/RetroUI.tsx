import React from 'react';

// Piezas comunes del estilo Gremio (los nombres se mantienen para no tocar a quien las usa).

interface BoxProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const RetroBox: React.FC<BoxProps> = ({ children, className = "", title }) => (
  <section className={`panel ${className}`}>
    {title && <h2 className="panel-titulo">{title}</h2>}
    {children}
  </section>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

const CLASES = { primary: 'btn-oro', secondary: 'btn-cuero', danger: 'btn-peligro' };

export const RetroButton: React.FC<ButtonProps> = ({ children, variant = 'primary', className = "", ...props }) => (
  <button className={`${CLASES[variant]} ${className}`} {...props}>{children}</button>
);

export const Estandarte = () => (
  <div className="estandarte" aria-hidden="true"><div><span className="emblema" /></div></div>
);

export const Fondo = () => <div className="fondo" aria-hidden="true" />;

export const Icono = ({ nombre, alt = '' }: { nombre: string; alt?: string }) => (
  <img src={`/arte/iconos/${nombre}.webp`} alt={alt} width={36} height={36} />
);
