export type ArchitectShiftRequest = {
  trialId: string;
  userText: string;
  currentLoadout: {
    title: string;
    summary: string;
  };
  runId?: string;
};

export type ArchitectShiftResponse =
  | {
      ok: true;
      dialogue: string;
      chargesDelta: number;
      validationWarnings: string[];
      loadout: {
        title: string;
        summary: string;
        movement: { tag: string; label: string };
        weapon: { tag: string; label: string };
        passive: { tag: string; label: string };
      };
    }
  | {
      ok: false;
      errorCode: string;
      message: string;
      chargesDelta: number;
    };

export async function requestArchitectShift(
  payload: ArchitectShiftRequest,
): Promise<ArchitectShiftResponse> {
  const response = await fetch("/api/architect/shift", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return (await response.json()) as ArchitectShiftResponse;
}
