let availableWeeks = [];

document.addEventListener('DOMContentLoaded', async () => {
  const slider = document.getElementById('weekSlider');
  const label  = document.getElementById('weekLabel');

  // 1. Load valid epiweeks from backend
  const res = await fetch('http://localhost:3000/available-weeks');
  availableWeeks = await res.json();

  // 2. Configure slider to index into valid weeks
  slider.min = 0;
  slider.max = availableWeeks.length - 1;
  slider.step = 1;
  slider.value = availableWeeks.length - 1; // latest week

  // 3. Initial render
  updateLabel(slider.value);
  reload();

  // 4. Respond to slider movement
  slider.addEventListener('input', () => {
    updateLabel(slider.value);
    reload();
  });

  function updateLabel(index) {
    const epiweek = availableWeeks[index];
    const year = Math.floor(epiweek / 100);
    const week = epiweek % 100;
    label.textContent = `${year} – Week ${week}`;
  }
});


async function reload() {
  const slider = document.getElementById('weekSlider');
  const epiweek = availableWeeks[slider.value];

  const response = await fetch(
    `http://localhost:3000/state-data?week=${epiweek}`
  );
  const stateData = await response.json();

  for (const state in simplemaps_usmap.mapdata.state_specific) {
    const ili = stateData[state];
    const color = ili !== undefined
      ? iliToColor(ili)
      : '#cccccc'; 

    simplemaps_usmap.mapdata.state_specific[state].color = color;
    simplemaps_usmap.refresh_state(state);
  }
}


function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function play() {
  const slider = document.getElementById('weekSlider');

  for (let i = Number(slider.value); i < availableWeeks.length; i++) {
    slider.value = i;

    await reload();

    const epiweek = availableWeeks[i];
    const year = Math.floor(epiweek / 100);
    const week = epiweek % 100;

    document.getElementById('weekLabel').textContent =
      `${year} – Week ${week}`;
  }
}




// Convert ILI to color (your original function)
function iliToColor(ili, min = 0, max = 10) {
  ili = Math.max(min, Math.min(max, ili));

  let t = (ili - min) / (max - min);

  let r = Math.round(255 * t);   
  let g = Math.round(255 * (1 - t)); 
  let b = 0;                    

  let hr = r.toString(16).padStart(2, "0");
  let hg = g.toString(16).padStart(2, "0");
  let hb = b.toString(16).padStart(2, "0");

  return `#${hr}${hg}${hb}`;
}
