type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type ArchitectShiftRequest = {
  trialId?: unknown;
  userText?: unknown;
  currentLoadout?: unknown;
  runId?: unknown;
};

type MockLoadout = {
  title: string;
  summary: string;
  movement: { tag: string; label: string };
  weapon: { tag: string; label: string };
  passive: { tag: string; label: string };
};

function json(data: JsonValue, init?: ResponseInit) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers,
    },
  });
}

function badRequest(message: string) {
  return json(
    {
      ok: false,
      errorCode: "BAD_REQUEST",
      message,
      chargesDelta: 0,
    },
    { status: 400 },
  );
}

function selectMockLoadout(prompt: string): {
  dialogue: string;
  validationWarnings: string[];
  loadout: MockLoadout;
} {
  const loweredPrompt = prompt.toLowerCase();

  if (
    loweredPrompt.includes("fast") ||
    loweredPrompt.includes("dash") ||
    loweredPrompt.includes("speed")
  ) {
    return {
      dialogue: "Momentum is legal. Height is not. I have sharpened your stride.",
      validationWarnings: [],
      loadout: {
        title: "Kinetic Strider",
        summary:
          "A grounded mobility build tuned for denied-jump traversal. High forward speed, cleaner landings, and a modest ranged option keep the player moving through broken geometry.",
        movement: {
          tag: "kinetic_stride",
          label: "Kinetic Stride",
        },
        weapon: {
          tag: "arc_burst",
          label: "Arc Burst",
        },
        passive: {
          tag: "stability_lattice",
          label: "Stability Lattice",
        },
      },
    };
  }

  if (
    loweredPrompt.includes("defend") ||
    loweredPrompt.includes("tank") ||
    loweredPrompt.includes("survive") ||
    loweredPrompt.includes("shield")
  ) {
    return {
      dialogue: "If you cannot rise above the fracture, then endure it and cross.",
      validationWarnings: [],
      loadout: {
        title: "Bulwark Route",
        summary:
          "A defensive traversal build that trades raw speed for impact resistance and steadier ranged pressure. It is built to survive the route rather than dominate it.",
        movement: {
          tag: "weighted_drive",
          label: "Weighted Drive",
        },
        weapon: {
          tag: "ember_lance",
          label: "Ember Lance",
        },
        passive: {
          tag: "impact_guard",
          label: "Impact Guard",
        },
      },
    };
  }

  if (
    loweredPrompt.includes("ranged") ||
    loweredPrompt.includes("control") ||
    loweredPrompt.includes("distance") ||
    loweredPrompt.includes("far")
  ) {
    return {
      dialogue: "Very well. If the floor denies you comfort, pressure the space before it reaches you.",
      validationWarnings: [
        "The Architect kept the response inside Trial 01 movement limits. No jump-enabling effects were allowed.",
      ],
      loadout: {
        title: "Sightline Weaver",
        summary:
          "A spacing-focused loadout with stable movement, lane pressure, and a calmer passive profile. It gives the player breathing room without breaking the trial's authored rule.",
        movement: {
          tag: "measured_stride",
          label: "Measured Stride",
        },
        weapon: {
          tag: "lane_cast",
          label: "Lane Cast",
        },
        passive: {
          tag: "focus_mesh",
          label: "Focus Mesh",
        },
      },
    };
  }

  return {
    dialogue: "Your phrasing was broad, so I selected a stable interpretation with grounded movement and controlled pressure.",
    validationWarnings: [
      "The Architect used a fallback interpretation. Try asking for speed, defense, or ranged control to steer the next rewrite.",
    ],
    loadout: {
      title: "Stable Fallback",
      summary:
        "A balanced starter rewrite that improves ground handling, grants a simple pressure tool, and adds a modest stabilizing passive without violating the denied-jump rule.",
      movement: {
        tag: "grounded_vector",
        label: "Grounded Vector",
      },
      weapon: {
        tag: "pulse_cast",
        label: "Pulse Cast",
      },
      passive: {
        tag: "calm_shell",
        label: "Calm Shell",
      },
    },
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        version: "0.1.0",
        service: "realityshift-worker",
      });
    }

    if (request.method === "POST" && url.pathname === "/api/architect/shift") {
      let payload: ArchitectShiftRequest;

      try {
        payload = (await request.json()) as ArchitectShiftRequest;
      } catch {
        return badRequest("The Architect received malformed JSON.");
      }

      if (typeof payload.trialId !== "string" || payload.trialId.length === 0) {
        return badRequest("A valid trialId is required.");
      }

      if (typeof payload.userText !== "string" || payload.userText.trim().length === 0) {
        return badRequest("The Architect requires a non-empty userText prompt.");
      }

      if (payload.trialId !== "trial_01_denied_ascent") {
        return json(
          {
            ok: false,
            errorCode: "UNKNOWN_TRIAL",
            message: "This scaffold only supports Trial 01: Denied Ascent.",
            chargesDelta: 0,
          },
          { status: 400 },
        );
      }

      const result = selectMockLoadout(payload.userText);

      return json({
        ok: true,
        dialogue: result.dialogue,
        loadout: result.loadout,
        chargesDelta: -1,
        validationWarnings: result.validationWarnings,
      });
    }

    return json(
      {
        ok: false,
        errorCode: "NOT_FOUND",
        message: "Route not found.",
      },
      { status: 404 },
    );
  },
};
