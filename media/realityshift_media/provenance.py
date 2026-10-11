"""Simulation provenance, bound into the Genblaze manifest.

The project's defining property — once a fork splits, no real-world data enters
it — is invisible in a finished video. Embedding it in the manifest, where it is
part of the canonical SHA-256, makes it verifiable: `genblaze verify` on a
downloaded asset re-derives the hash, so the simulation fields cannot be altered
without breaking verification.

Verified on genblaze-core 0.3.8 (schema 1.5): Run.metadata is included in the
canonical hash, and changing simulation.fork_id changes the hash. See
media/tests/test_provenance.py.
"""
from __future__ import annotations

from typing import Any

from .contracts import DivergenceBrief, cutoff_iso


def simulation_metadata(brief: DivergenceBrief) -> dict[str, Any]:
    """The `simulation.*` provenance block for Pipeline.metadata(**...).

    Applied as `pipeline.metadata(simulation=simulation_metadata(brief))`, which
    merges into Run.metadata and is therefore covered by the canonical hash.

    The key set is fixed: every key is always present, including
    `real_world_data_cutoff` when it is null (live world, sample). A null value
    is still part of the canonical JSON, so it is bound into the hash exactly
    like a timestamp: stripping it or swapping in a timestamp breaks
    verification.
    """
    return {
        "fork_id": brief.fork_id,
        "parent_fork_id": brief.parent_fork_id,
        "divergence_date": brief.divergence_date.isoformat(),
        "sim_date": brief.sim_date.isoformat(),
        # Fork: worlds.created_at as ISO-8601 UTC. Live world / sample: null.
        "real_world_data_cutoff": cutoff_iso(brief.real_world_data_cutoff),
        # True for the live world, which keeps ingesting real news monthly.
        "live_world": brief.live_world,
        # True only for explicit synthetic sample briefs; never real media.
        "sample": brief.sample,
        "nation_iso": brief.nation_iso,
        # Constants, but they are the whole point: a verifier reads these off the
        # asset without needing to know how RealityShift works.
        "is_counterfactual": True,
        "consensus_reality": False,
    }


def apply_provenance(pipeline: Any, brief: DivergenceBrief) -> Any:
    """Attach simulation provenance + a stable tenant to a pipeline.

    tenant_id is the fork, so B2 layout and any Parquet analytics partition per
    fork/user naturally.
    """
    return pipeline.metadata(simulation=simulation_metadata(brief))
