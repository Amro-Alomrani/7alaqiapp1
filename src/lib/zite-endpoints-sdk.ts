
const RESPONSES: Record<string, string> = {
  'fade': "For the best fades, I'd recommend **Omar Hassan** at The Fade Factory! 🔥\n\nHe specializes in High Fades, Design Cuts, and Skin Fades. Rating: 4.8⭐\nPrices start from $20.\n\nWould you like me to book an appointment with him?",
  'best': "Our top-rated barbers are:\n\n1. **Tarek Ibrahim** ⭐ 5.0 — The Gentleman's Cut (Luxury grooming)\n2. **Ahmed Al-Rasheed** ⭐ 4.9 — Classic Cuts specialist\n3. **Omar Hassan** ⭐ 4.8 — The Fade Factory\n\nWhat style are you looking for? I can match you with the perfect barber!",
  'book': "I'd love to help you book! 📅\n\nHere are our available barbers:\n- **Ahmed Al-Rasheed** — Available today\n- **Omar Hassan** — Available today\n- **Khalid Al-Mansoor** — Available today\n- **Yusuf Karimi** — Available tomorrow\n\nJust head to the **Explore** tab to pick your barber and time slot, or tell me who you'd prefer!",
  'service': "Here are our services:\n\n💇 **Classic Haircut** — $15 (30 min)\n✂️ **Fade & Taper** — $20 (45 min)\n🧔 **Beard Trim** — $10 (20 min)\n👑 **Full Package** — $35 (75 min)\n\nThe Full Package includes haircut, beard trim, hot towel, and styling. It's our most popular choice!",
  'price': "Our pricing:\n\n💇 Classic Haircut — **$15**\n✂️ Fade & Taper — **$20**\n🧔 Beard Trim — **$10**\n👑 Full Package — **$35**\n\nAll our barbers offer premium quality service. Tips are always appreciated! 😊",
  'loyalty': "You currently have **280 loyalty points**! 🎉\n\nHere's how it works:\n- Earn **10 points** per booking\n- **50 points** = Free beard trim\n- **100 points** = $10 off any service\n- **200 points** = Free Classic Haircut\n\nYou're just 20 points away from a free Classic Haircut! Book your next appointment to earn more.",
  'point': "You currently have **280 loyalty points**! 🎉\n\nYou're close to unlocking a free Classic Haircut (200 points). Keep booking to earn more!",
};

const DEFAULT_RESPONSE = "Great question! 💈\n\nI can help you with:\n- **Finding barbers** based on your style preferences\n- **Booking appointments** at the best times\n- **Style recommendations** for your hair type\n- **Service info** and pricing\n- **Loyalty points** and rewards\n\nWhat would you like to know more about?";

function findResponse(messages: { role: string; content: string }[]): string {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUserMsg) return DEFAULT_RESPONSE;

  const lower = lastUserMsg.content.toLowerCase();
  for (const [key, response] of Object.entries(RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  return DEFAULT_RESPONSE;
}

export function chat(input: { messages: { role: string; content: string }[] }): AsyncIterable<string> {
  const fullResponse = findResponse(input.messages);

  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index >= fullResponse.length) {
            return { done: true, value: undefined };
          }
          const chunkSize = Math.floor(Math.random() * 3) + 1;
          const chunk = fullResponse.slice(index, index + chunkSize);
          index += chunkSize;
          await new Promise(r => setTimeout(r, 15 + Math.random() * 25));
          return { done: false, value: chunk };
        },
      };
    },
  };
}
