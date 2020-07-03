/*global d3, topojson*/
var re = /^([0-9]+)\/([0-9]+)\/([0-9]+)$/;
function dateStrToDay(str) {
  var [, m, d, y] = re.exec(str);
  return (
    new Date(Date.UTC(2000 + Number(y), +m - 1, +d)).getTime() /
    24 /
    60 /
    60 /
    1000
  );
}
function dayToDateStr(d) {
  var date = new Date(d * 1000 * 60 * 60 * 24);
  return [
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCFullYear() - 2000,
  ].join("/");
}
function dayToLongDateStr(d) {
  var date = new Date(d * 1000 * 60 * 60 * 24);
  return date.toLocaleDateString(undefined, {
    timeZone: "UTC",
    dateStyle: "long",
  });
}

const makeSlider = (function () {
  var PLAY_PAUSE_SIZE = 20;
  var EQUILATERAL_TRIANGLE_HEIGHT = Math.sqrt(0.75);
  var TRIANGLE_CENTER_OF_MASS =
    EQUILATERAL_TRIANGLE_HEIGHT * (1 - 1 / Math.sqrt(2));
  var lineFunction = d3
    .line()
    .x((d) => d[0])
    .y((d) => d[1]);

  var MS_AT_MIN_DAY = 1000;
  var MS_AT_MAX_DAY = 2000;
  var MS_AT_EACH_DAY = 75;

  function renderPlay(selection) {
    var size = PLAY_PAUSE_SIZE;
    var triangleHeight = size * EQUILATERAL_TRIANGLE_HEIGHT;
    var centerOfMass = size * TRIANGLE_CENTER_OF_MASS;

    selection
      .attr(
        "d",
        lineFunction([
          [-centerOfMass, 0],
          [-centerOfMass, -size / 2],
          [triangleHeight - centerOfMass, 0],
          [triangleHeight - centerOfMass, 0],
          [-centerOfMass, 0],
        ]) +
          lineFunction([
            [-centerOfMass, 0],
            [-centerOfMass, size / 2],
            [triangleHeight - centerOfMass, 0],
            [triangleHeight - centerOfMass, 0],
            [-centerOfMass, 0],
          ])
      )
      .attr("transform", "rotate(0)");
  }

  function renderPause(selection) {
    var size = PLAY_PAUSE_SIZE;

    selection
      .attr(
        "d",
        lineFunction([
          [-(size / 2), -(size / 2) + size / 3],
          [-(size / 2), -size / 2],
          [size / 2, -size / 2],
          [size / 2, -(size / 2) + size / 3],
          [-(size / 2), -(size / 2) + size / 3],
        ]) +
          lineFunction([
            [-(size / 2), size / 2 - size / 3],
            [-(size / 2), size / 2],
            [size / 2, size / 2],
            [size / 2, size / 2 - size / 3],
            [-(size / 2), size / 2 - size / 3],
          ])
      )
      .attr("transform", "rotate(90)");
  }

  return function makeSlider({
    element,
    dayRange,
    onDayChange = () => {},
    persist = () => {},
    width: outerWidth = 800,
    height: outerHeight = 70,
    dayValues,
    color,
  }) {
    let day = dayRange[0];
    var margin = {
      top: 20,
      right: 55,
      bottom: 20,
      left: 70,
    };

    var height = outerHeight - margin.top - margin.bottom;
    var width = outerWidth - margin.left - margin.right;

    var [minDay, maxDay] = dayRange;

    var scale = d3.scaleLinear().domain(dayRange).range([0, width]);

    var invertScale = d3
      .scaleLinear()
      .domain([0, width])
      .rangeRound(dayRange)
      .clamp(true);

    function handleDrag() {
      stop();
      const [x] = d3.mouse(container.node());
      onDayChange(invertScale(x));
    }

    var container = d3
      .select(element)
      .append("svg")
      .attr("width", outerWidth)
      .attr("height", outerHeight)
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left},${margin.top + height / 2})`
      );

    var svg = container.append("g");

    d3
      .drag()
      .on("drag", handleDrag)
      .on("start", handleDrag)
      .on("end", persist)
      .container(container.node())(svg);

    var months = d3
      .axisBottom(
        d3
          .scaleTime()
          .domain(dayRange.map((d) => new Date(d * 1000 * 24 * 60 * 60)))
          .rangeRound([0, width])
      )
      .ticks(d3.utcMonth)
      .tickFormat(d3.utcFormat("%b %e"));
    svg
      .selectAll("rect")
      .data(dayValues)
      .enter()
      .append("rect")
      .attr("width", width / dayValues.length)
      .attr("height", 6)
      .attr("x", (d, i) => scale(i + minDay))
      .attr("y", -3)
      .attr("stroke", "none")
      .attr("fill", color);
    svg.append("g").attr("transform", "translate(0,-3)").call(months);

    var slider = svg.append("circle").attr("class", "currentDay").attr("r", 5);

    svg
      .append("rect")
      .attr("class", "touchTarget")
      .attr("x", -10)
      .attr("y", -(height / 2) - margin.top)
      .attr("height", height + margin.top + margin.bottom)
      .attr("width", width + margin.right + 10);

    let playing = false;
    var playPauseContainer = container
      .append("g")
      .attr("transform", `translate(${-margin.left / 2})`);

    var playPause = playPauseContainer.append("path").call(renderPlay);

    playPauseContainer
      .append("circle")
      .attr("class", "touchTarget")
      .attr("r", PLAY_PAUSE_SIZE);

    let timer;

    function stop(dontPersist) {
      if (playing && !dontPersist) {
        persist();
      }
      playing = false;
      if (timer) timer.stop();
      playPause.transition().ease(d3.easeCubicOut).call(renderPlay);
    }

    function nextTick() {
      if (day === maxDay) {
        onDayChange(minDay);
        timer = d3.timeout(nextTick, MS_AT_MIN_DAY);
      } else if (day === maxDay - 1) {
        onDayChange(maxDay);
        timer = d3.timeout(nextTick, MS_AT_MAX_DAY);
      } else {
        onDayChange(day + 1);
        timer = d3.timeout(nextTick, MS_AT_EACH_DAY);
      }
    }

    function start() {
      playing = true;
      nextTick();
      playPause.transition().ease(d3.easeCubicOut).call(renderPause);
    }

    playPauseContainer.on("click", () => {
      if (playing) {
        stop();
      } else {
        start();
      }
    });

    return {
      setDay(newDay) {
        day = newDay;
        slider.attr("cx", scale(day));
      },
      stop,
      start,
    };
  };
})();

Promise.all([
  d3.json("./us.json"),
  d3.csv(
    "https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_confirmed_usafacts.csv"
  ),
  d3.csv(
    "https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_county_population_usafacts.csv"
  ),
]).then(([us, cases, population]) => {
  var countyIdToName = {};
  var countyIdToPopulation = {};
  var countyIdToCases = {};

  population.forEach((d) => {
    countyIdToName[d["countyFIPS"]] = d["County Name"];
    countyIdToPopulation[d["countyFIPS"]] = +d["population"];
  });
  cases.forEach((d) => {
    countyIdToCases[d["countyFIPS"]] = d;
  });
  var width = 960,
    height = 600,
    padding = {
      top: 20,
      left: -60,
      bottom: 20,
      right: 20,
    };
  var color = d3
    .scaleLinear()
    .domain([1, 10, 20, 40, 100])
    .interpolate(d3.interpolateLab)
    .clamp(true)
    .range([
      "rgb(116,197,124)",
      "rgb(238,213,59)",
      "rgb(228,169,91)",
      "rgb(209,40,70)",
      "hsl(349, 68%, 20%)",
    ]);

  var svg = d3
    .select("#map")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .style("height", "auto")
    .attr("preserveAspectRatio", "xMinYMin meet");
  var path = d3.geoPath(
    d3.geoAlbersUsa().fitExtent(
      [
        [padding.left, padding.top],
        [width - padding.right, height - padding.top],
      ],
      topojson.feature(us, us.objects.states)
    )
  );
  var counties = svg
    .append("g")
    .attr("class", "county")
    .selectAll("path")
    .data(topojson.feature(us, us.objects.counties).features)
    .enter()
    .append("path")
    .attr("d", path)
    .style("stroke", "white")
    .style("stroke-opacity", 1)
    .style("stroke-width", 0.25);
  svg
    .append("g")
    .attr("class", "state")
    .selectAll("path")
    .data(topojson.feature(us, us.objects.states).features)
    .enter()
    .append("path")
    .attr("d", path)
    .style("stroke", "white")
    .style("fill", "none")
    .style("stroke-opacity", 1)
    .style("stroke-width", 0.5);

  var days = [];
  Object.keys(cases[0]).forEach(function (c) {
    if (re.test(c)) {
      days.push(dateStrToDay(c));
    }
  });

  var currentDay;
  function setDay(day) {
    currentDay = day;
    slider.setDay(day);
    var start = dayToDateStr(day - 7);
    var end = dayToDateStr(day);
    counties.attr("fill", ({ id }) => {
      return countyIdToCases[id]
        ? color(
            (100000 *
              (Number(countyIdToCases[id][end]) -
                Number(countyIdToCases[id][start]))) /
              countyIdToPopulation[id] /
              7
          )
        : "rgb(116,197,124)";
    });
    d3.select(".date").text(dayToLongDateStr(day));
  }

  const totalPop = d3.sum(population, (p) => Number(p["population"]));
  const dayValues = days.slice(7).map((day) => {
    var start = dayToDateStr(day - 7);
    var end = dayToDateStr(day);
    const total = d3.sum(cases, (d) => Number(d[end]) - Number(d[start]));
    return (100000 * total) / totalPop / 7;
  });

  const slider = makeSlider({
    element: "#slider",
    onDayChange: setDay,
    // persist: setDay,
    width: 600,
    height: 70,
    dayRange: d3.extent(days.slice(7)),
    dayValues,
    color,
  });
  setDay(d3.max(days));

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      setDay(Math.max(currentDay - 1, days[7]));
    } else if (e.key === "ArrowRight") {
      setDay(Math.min(currentDay + 1, days[days.length - 1]));
    } else if (e.key === "Home") {
      setDay(days[7]);
    } else if (e.key === "End") {
      setDay(days[days.length - 1]);
    }
  });

  d3.selectAll(".hidden").classed("hidden", false);
});
