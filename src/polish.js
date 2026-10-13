// FlowTate — post-ASR polish pass.
// v0.1: light cleanup. v0.2: LLM pass (fillers, punctuation, spoken self-corrections).
async function polish(text) {
  return (text || '').trim().replace(/\s+/g, ' ');
}

module.exports = { polish };
