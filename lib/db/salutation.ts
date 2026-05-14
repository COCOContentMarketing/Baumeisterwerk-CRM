import type { Interaction, SalutationForm } from "@/types/db";

/** True, wenn im Verlauf mindestens ein Termin (Meeting) stattgefunden hat. */
export function hasMeeting(interactions: Interaction[]): boolean {
  return interactions.some((i) => i.type === "meeting");
}

// Standard-Anrede ableiten: Nach einem persoenlichen Termin ist im
// Baumeisterwerk-Umfeld das "Du" ueblich, davor wird gesiezt.
export function deriveSalutationDefault(
  interactions: Interaction[],
): SalutationForm {
  return hasMeeting(interactions) ? "du" : "sie";
}
