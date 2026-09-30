import arcDiagram from "./arc-diagram.js";

d3.csv("data/data.csv", d3.autoType).then((data) => {
  arcDiagram({
    el: document.querySelector("#figure"),
    data,
  });
});
