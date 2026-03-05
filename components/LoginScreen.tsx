import React, { useState } from 'react';
import { RetroBox, RetroButton } from './RetroUI';
import { User, ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (name: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, introduce tu nombre.');
      return;
    }
    if (name.length > 15) {
      setError('El nombre es demasiado largo (máx 15 caracteres).');
      return;
    }
    onLogin(name.trim());
  };

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-4 font-retro relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
      
      <RetroBox title="IDENTIFICACIÓN DE HÉROE" className="w-full max-w-md bg-[#1a1a1a] border-blue-500 shadow-2xl relative z-10">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-4">
          <div className="text-center text-gray-300 text-xs md:text-sm mb-2">
            <p>Bienvenido, estudiante.</p>
            <p>Para comenzar tu aventura y guardar tu progreso, identifícate.</p>
          </div>

          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="TU NOMBRE"
              className="w-full bg-[#000] border-2 border-gray-600 text-white p-3 pl-10 rounded focus:border-blue-500 focus:outline-none uppercase tracking-widest font-mono text-center"
              autoFocus
            />
          </div>

          {error && <p className="text-red-500 text-xs text-center animate-bounce">{error}</p>}

          <RetroButton type="submit" className="w-full bg-blue-700 border-blue-500 shadow-[0_4px_0_rgb(29,78,216)] active:shadow-none active:translate-y-[4px] flex justify-center items-center gap-2">
            <span>COMENZAR</span> <ArrowRight size={16} />
          </RetroButton>
        </form>
      </RetroBox>
    </div>
  );
}
