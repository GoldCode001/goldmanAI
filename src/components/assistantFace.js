let expanded = false;

export function initAssistantFace() {
  const face = document.getElementById("assistantFace");
  if (!face) return;

  face.addEventListener("click", toggleExpand);
}

function toggleExpand() {
  expanded = !expanded;
  document.body.classList.toggle("expanded", expanded);
}
