import React from 'react';

/**
 * Utility for Cloze flashcard parsing and rendering
 */
export const ClozeUtils = {
  /**
   * Replaces {{c1::text}} with [...] for the question side
   */
  getHiddenText: (text: string): string => {
    return text.replace(/\{\{c1::(.*?)\}\}/g, '[...]');
  },

  /**
   * Highlights the hidden text for the answer side or curation
   */
  getRevealedElement: (text: string, className: string = "text-accent font-bold"): React.ReactNode => {
    const parts = text.split(/(\{\{c1::.*?\}\})/g);
    
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('{{c1::') && part.endsWith('}}')) {
            const innerText = part.substring(6, part.length - 2);
            return <span key={i} className={className}>{innerText}</span>;
          }
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  },

  /**
   * Checks if a text has a valid Cloze marker
   */
  hasCloze: (text: string): boolean => {
    return /\{\{c1::.*?\}\}/.test(text);
  }
};
