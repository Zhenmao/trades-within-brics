export default function arcDiagram({ el, data }) {
  let highlighted = null;

  const step = 80;
  const minNodeSize = 8;
  const maxNodeSize = 48;
  const minLinkSize = 1;
  const maxLinkSize = 20;

  const { nodes, links } = processData(data);

  const formatValue = (d) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
    }).format(d * 1e9);

  const xScale = d3
    .scalePoint()
    .domain(nodes.map((d) => d.id))
    .range([0, step * nodes.length - 1]);

  const rScale = d3
    .scaleSqrt()
    .domain(d3.extent(nodes, (d) => d.total))
    .range([minNodeSize, maxNodeSize]);

  const colorScale = d3
    .scaleOrdinal()
    .domain(["export", "import", "muted"])
    .range([
      "var(--color-export)",
      "var(--color-import)",
      "var(--color-muted)",
    ]);

  const wScale = d3
    .scaleLinear()
    .domain(d3.extent(links, (d) => d.value))
    .range([minLinkSize, maxLinkSize]);

  const linkThreshold = 1;

  const linkArc = (d) => {
    const x1 = xScale(d.source.id);
    const x2 = xScale(d.target.id);
    const r = Math.abs(x2 - x1) / 2;
    return `M${x1},0 A${r},${r},0,0,0,${x2},0`;
  };

  const linkLabelTransform = (d) => {
    const x1 = xScale(d.source.id);
    const x2 = xScale(d.target.id);
    const x = (x1 + x2) / 2;
    const r = Math.abs(x2 - x1) / 2;
    const y = x1 > x2 ? -r : r;
    return `translate(${x},${y})`;
  };

  const pie = d3
    .pie()
    .sort(null)
    .value((d) => d.value);

  const arcLocal = d3.local();

  const container = d3.select(el).classed("arc-diagram", true);

  const svg = container.append("svg");

  const g = svg.append("g");

  const link = g
    .append("g")
    .attr("class", "links")
    .selectChildren()
    .data(links, (d) => d.id)
    .join("g")
    .attr("class", "link")
    .attr("opacity", (d) => (d.value >= linkThreshold ? 1 : 0));

  const linkPath = link
    .append("path")
    .attr("class", "link__path")
    .attr("fill", "none")
    .attr("stroke", "var(--color-link)")
    .attr("stroke-width", (d) => wScale(d.value))
    .attr("d", linkArc);

  const linkLabel = link
    .append("text")
    .attr("class", "link__label")
    .attr("text-anchor", "middle")
    .attr("dy", "0.32em")
    .attr("transform", linkLabelTransform)
    .attr("opacity", 0)
    .text((d) => formatValue(d.value));

  const node = g
    .append("g")
    .attr("class", "nodes")
    .selectChildren()
    .data(nodes, (d) => d.id)
    .join("g")
    .attr("class", "node")
    .attr("transform", (d) => `translate(${xScale(d.id)},0)`)
    .each(function (d) {
      arcLocal.set(this, d3.arc().innerRadius(0).outerRadius(rScale(d.total)));
    })
    .on("mouseenter", highlight)
    .on("mouseleave", reset);

  const nodePath = node
    .append("g")
    .attr("class", "node__paths")
    .selectChildren()
    .data(getPieData)
    .join("path")
    .attr("class", "node__path")
    .attr("fill", (d) => colorScale(d.data.key))
    .attr("d", function (d) {
      const arc = arcLocal.get(this);
      return arc(d);
    });

  const nodeLabel = node
    .append("text")
    .attr("class", "node__label")
    .attr("text-anchor", "middle")
    .attr("dy", "0.71em")
    .attr("y", maxNodeSize + 4)
    .text((d) => d.name);

  sizeSVG(svg, g);

  function highlight(_, d) {
    highlighted = d.id;

    link
      .transition()
      .duration(150)
      .attr("opacity", (d) =>
        d.source.id === highlighted || d.target.id === highlighted ? 1 : 0,
      );

    linkPath.attr("stroke", (d) => {
      if (d.source.id === highlighted) return "var(--color-export)";
      if (d.target.id === highlighted) return "var(--color-import)";
      return "var(--color-link)";
    });

    linkLabel.attr("opacity", (d) =>
      d.source.id === highlighted || d.target.id === highlighted ? 1 : 0,
    );

    nodePath
      .data(getPieData)
      .transition()
      .duration(500)
      .attrTween("d", pieArcTween);
  }

  function reset() {
    highlighted = null;

    link
      .transition()
      .duration(150)
      .attr("opacity", (d) => (d.value >= linkThreshold ? 1 : 0));

    linkPath.attr("stroke", "var(--color-link)");

    linkLabel.attr("opacity", 0);

    nodePath
      .data(getPieData)
      .transition()
      .duration(500)
      .attrTween("d", pieArcTween);
  }

  function pieArcTween(d) {
    const i = d3.interpolate(this._current, d);
    this._current = i(0);
    const arc = arcLocal.get(this);
    return function (t) {
      return arc(i(t));
    };
  }

  function sizeSVG(svg, g) {
    const { x, y, width, height } = g.node().getBBox();
    const x1 = Math.floor(x);
    const y1 = Math.floor(y);
    const x2 = Math.ceil(x + width);
    const y2 = Math.ceil(y + height);
    const w = x2 - x1;
    const h = y2 - y1;
    svg.attr("width", w).attr("height", h).attr("viewBox", [x1, y1, w, h]);
  }

  function getPieData(d) {
    let exportValue = d.valueMap.get("export");
    let importValue = d.valueMap.get("import");
    let mutedValue = 0;

    if (highlighted && d.id !== highlighted) {
      exportValue =
        d.links.find((l) => l.target.id === highlighted)?.value ?? 0;
      importValue =
        d.links.find((l) => l.source.id === highlighted)?.value ?? 0;
      mutedValue = d.total - exportValue - importValue;
    }

    return pie([
      { key: "export", value: exportValue },
      { key: "import", value: importValue },
      { key: "muted", value: mutedValue },
    ]);
  }

  function processData(csv) {
    const accessors = {
      sourceName: (d) => d["Exporter"],
      targetName: (d) => d["Importer"],
      value: (d) => d["Value (in USD Billions)"],
    };

    const nodeMap = new Map();
    const linkMap = new Map();

    csv.forEach((d) => {
      const sourceName = accessors.sourceName(d);
      const targetName = accessors.targetName(d);
      const value = accessors.value(d);

      if (value === "No Data") return;

      if (!nodeMap.has(sourceName)) {
        nodeMap.set(sourceName, {
          id: sourceName,
          name: sourceName,
          links: [],
          valueMap: new Map([
            ["export", 0],
            ["import", 0],
          ]),
        });
      }
      const source = nodeMap.get(sourceName);
      source.valueMap.set("export", source.valueMap.get("export") + value);

      if (!nodeMap.has(targetName)) {
        nodeMap.set(targetName, {
          id: targetName,
          name: targetName,
          links: [],
          valueMap: new Map([
            ["export", 0],
            ["import", 0],
          ]),
        });
      }
      const target = nodeMap.get(targetName);
      target.valueMap.set("import", target.valueMap.get("import") + value);

      const linkId = [sourceName, targetName].join("|");
      const link = {
        id: linkId,
        source,
        target,
        value,
      };
      linkMap.set(linkId, link);
      source.links.push(link);
      target.links.push(link);
    });

    nodeMap.forEach((d) => {
      d.total = d3.sum(d.valueMap.values());
    });

    const nodes = [...nodeMap.values()].sort((a, b) =>
      d3.descending(a.total, b.total),
    );

    const links = [...linkMap.values()].sort((a, b) =>
      d3.descending(a.value, b.value),
    );

    return {
      nodes,
      links,
    };
  }
}
