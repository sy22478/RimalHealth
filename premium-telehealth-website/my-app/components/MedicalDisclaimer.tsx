import React from 'react';
import { Info } from 'lucide-react';

export function MedicalDisclaimer() {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      <div className="flex flex-col items-center text-center">
        <Info className="w-5 h-5 text-gray-400 mb-3" />
        <p className="text-xs text-gray-500 leading-relaxed">
          Medical Disclaimer: The information provided on this website is for educational purposes only and is not intended as medical advice. Always consult with a qualified healthcare provider before starting any treatment. Individual results may vary. FDA-approved medications are prescribed based on physician evaluation. California-licensed physicians only.
        </p>
      </div>
    </div>
  );
}
