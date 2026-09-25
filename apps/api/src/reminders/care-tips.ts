// Short, general pet-care tips sent one per week. Deliberately not medical advice; anything about health
// points to the vet. Picked deterministically from the week number so re-runs never change the tip.
export const CARE_TIPS: Record<'dog' | 'cat', string[]> = {
  dog: [
    'Brush your dog a few times a week. It cuts shedding and helps you spot lumps, ticks or skin problems early.',
    'Most dogs need their teeth brushed. Even a few times a week reduces bad breath and gum disease.',
    'Fresh water should always be within reach, especially in summer. Refill the bowl daily.',
    'Hot pavement burns paws. If it is too hot for your hand, it is too hot for them. Walk early or late.',
    'Trim nails when you hear them clicking on the floor. Long nails change how a dog walks.',
    'Ticks and fleas are worst after rain. Check ears, armpits and between the toes after walks.',
    'Ear flaps and floppy-eared breeds trap moisture. Wipe ears gently after a bath and see a vet if they smell.',
    'Puzzle toys and sniff walks tire a dog out as much as a long run, and are great on rainy days.',
    'Keep human foods like chocolate, grapes, onions and xylitol sweeteners well out of reach.',
    'Regular short training sessions beat one long one. Five relaxed minutes a day builds good habits.',
    'Never leave a dog in a parked car, even for a few minutes. It heats up dangerously fast.',
    'Weigh your dog every month or two. Small gains add up quickly and make joints work harder.',
  ],
  cat: [
    'Brush your cat regularly, especially long-haired breeds. It prevents mats and reduces hairballs.',
    'Cats hide illness. A change in appetite, litter habits or hiding more than usual is worth a vet visit.',
    'Scoop the litter box daily. Many cats stop using a dirty box.',
    'Provide a scratching post. It saves your furniture and keeps claws healthy.',
    'Fresh water in more than one spot, or a fountain, encourages cats to drink enough.',
    'Play for ten minutes a day with a wand toy. It keeps indoor cats fit and happy.',
    'Lilies are highly toxic to cats. Never keep them at home, even the pollen is dangerous.',
    'Trim the sharp tips of claws every few weeks if your cat does not wear them down.',
    'Cats like high places to rest. A shelf or cat tree gives them a safe lookout.',
    'Regular dental care matters for cats too. Ask your vet about tooth-friendly food or brushing.',
    'Introduce new food gradually over a week to avoid an upset stomach.',
    'Keep windows and balconies netted. Cats can fall even from a low floor.',
  ],
};

export function tipFor(species: 'dog' | 'cat', weekIndex: number, salt: number): string {
  const list = CARE_TIPS[species];
  return list[(weekIndex + salt) % list.length]!;
}
