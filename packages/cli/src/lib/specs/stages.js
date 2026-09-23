// Shared approval-stage vocabulary (spec lists/invalidation live with approval state).
const STAGES = [
  "draft",
  "product-approved",
  "technical-approved",
  "implementation-approved",
  "release-approved"
];


function stageOrder(stage) {
  return STAGES.indexOf(stage);
}

export { STAGES, stageOrder };
