import { Redirect } from 'expo-router';

// The per-pet chat was replaced by Dr. Woof, who knows all of the customer's pets. Old links and notifications
// that still point here land on Dr. Woof instead of a dead screen.
export default function LegacyPetChat() {
  return <Redirect href="/dr-woof" />;
}
