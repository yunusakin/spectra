// Approval state, decision graph and adoption defaults.
function buildGovernanceDefaults({ featureId, safeProjectName }) {
  return {
    approvalState: {
      apiVersion: "spectra/v2",
      kind: "ApprovalState",
      current_state: "draft",
      highest_valid_state: "draft",
      stages: {
        "product-approved": { approved_at: null, baseline_commit: null, dirty: false },
        "technical-approved": { approved_at: null, baseline_commit: null, dirty: false },
        "implementation-approved": { approved_at: null, baseline_commit: null, dirty: false },
        "release-approved": { approved_at: null, baseline_commit: null, dirty: false }
      },
      invalidations: []
    },
    decisionGraph: {
      apiVersion: "spectra/v2",
      kind: "DecisionGraph",
      metadata: {
        version: "0.1.0",
        feature_id: featureId
      },
      decisions: [
        {
          decision_id: "DEC-001",
          question_id: "PI-001",
          title: "Primary product scope centers on spec-driven AI development.",
          depends_on: [],
          affects: [
            `artifact:sdd/features/${featureId}/feature.spec.yaml`,
            `decision:DEC-002`
          ],
          risk_level: "high",
          reversibility: "moderate",
          owner: "product",
          evidence: [`sdd/features/${featureId}/brief.md`],
          review_date: null,
          status: "draft",
          approval_policy: "review"
        },
        {
          decision_id: "DEC-002",
          question_id: "AI-001",
          title: "Implementation stays blocked until implementation approval is granted.",
          depends_on: ["decision:DEC-001"],
          affects: [
            `artifact:sdd/features/${featureId}/ai-behavior-spec.yaml`,
            "gate:implementation"
          ],
          risk_level: "critical",
          reversibility: "hard",
          owner: "engineering",
          evidence: [`sdd/features/${featureId}/ai-behavior-spec.yaml`],
          review_date: null,
          status: "draft",
          approval_policy: "reapprove"
        }
      ]
    },
    adoption: {
      currentState: {
        apiVersion: "spectra/v2",
        kind: "CurrentStateSummary",
        repo_mode: "brownfield",
        services: [],
        discovery_sources: [],
        generated_at: null
      },
      gapAnalysis: {
        apiVersion: "spectra/v2",
        kind: "GapAnalysis",
        summary: { matches: 0, partial: 0, missing: 0, conflict: 0, unknown: 0 },
        items: []
      },
      reviewQueue: {
        apiVersion: "spectra/v2",
        kind: "ReviewQueue",
        items: []
      }
    }
  };
}

export { buildGovernanceDefaults };
