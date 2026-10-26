import type { StyleMood } from '@/types';

/** General haircut inspiration. These are not barber listings or bookable services. */
export const styleMoods: StyleMood[] = [
  { id: 'm1', label: 'Sharp & Professional', emoji: '👔', description: 'Crisp, clean, business-ready', gradient: 'from-blue-600 to-indigo-700', barberIds: [], styles: ['Classic Side Part', 'Executive Crop', 'Clean Fade'] },
  { id: 'm2', label: 'Bold & Modern', emoji: '⚡', description: 'Statement cuts, fades, designs', gradient: 'from-orange-500 to-red-600', barberIds: [], styles: ['Skin Fade', 'Mohawk', 'Design Cut'] },
  { id: 'm3', label: 'Classic Gentleman', emoji: '🎩', description: 'Timeless, elegant, refined', gradient: 'from-amber-600 to-yellow-700', barberIds: [], styles: ['Pompadour', 'Slick Back', 'Hot Towel Shave'] },
  { id: 'm4', label: 'Casual & Relaxed', emoji: '🌊', description: 'Easy maintenance, natural look', gradient: 'from-cyan-500 to-teal-600', barberIds: [], styles: ['Textured Crop', 'Natural Wave', 'Buzz Cut'] },
];
