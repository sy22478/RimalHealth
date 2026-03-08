import React from 'react';

interface SectionWrapperProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function SectionWrapper({ children, className = '', id }: SectionWrapperProps) {
  return (
    <section className={`section-padding ${className}`} id={id}>
      <div className="container-custom">
        {children}
      </div>
    </section>
  );
}
