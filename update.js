let availableWeeks = [];

var stopPlay = false;

document.addEventListener('DOMContentLoaded', async () => {
  const slider = document.getElementById('weekSlider');
  const label = document.getElementById('weekLabel');

  const res = await fetch('http://localhost:3000/available-weeks');
  availableWeeks = await res.json();

  slider.min = 0;
  slider.max = availableWeeks.length - 1;
  slider.step = 1;
  slider.value = availableWeeks.length - 1;

  updateLabel(slider.value);
  reload();

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
  stopPlay = false;
  const slider = document.getElementById('weekSlider');
  const speed = document.getElementById('speedSlider');

  for (let i = Number(slider.value); i < availableWeeks.length; i++) {
    slider.value = i;

    await reload();
    await delay(200 - speed.value)

    setWeekLabel(availableWeeks[i]);

    if (stopPlay) {
      break;
    }
  }
}

function stopPlaying() {
  stopPlay = true;
}

function nextWeek(future) {
  const slider = document.getElementById('weekSlider');
  if (future)
    slider.value++;
  else
    slider.value--;

  setWeekLabel(availableWeeks[slider.value]);
  reload();
}

function nextYear(future) {
  const slider = document.getElementById('weekSlider');
  var week = availableWeeks[slider.value];
  if (future)
    week += 100;
  else
    week -= 100;

  var index = availableWeeks.indexOf(week);
  while (index == -1) {
    week--;
    index = availableWeeks.indexOf(week);
    // in case of week 53
  } 
  slider.value = index;
  setWeekLabel(availableWeeks[slider.value]);
  reload();

}


function setWeekLabel(epiweek) {
  const year = Math.floor(epiweek / 100);
  const week = epiweek % 100;

  document.getElementById('weekLabel').textContent =
    `${year} – Week ${week}`;
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
