import fs from "node:fs";
import {describe,it,expect} from "vitest";
import {loadTemplate} from "../package";
import {buildLegendSlideXml,metricDefinition} from "../legend-slide";

describe("selected metric guide",()=>{
  it.each(["dark","meta-ads-light"])("keeps correct title/definition pairs without template filler in %s",async name=>{
    const template=await loadTemplate(fs.readFileSync(`templates/${name}.pptx`));
    const xml=buildLegendSlideXml(template.legend.xml,[{term:"REACH",explanation:"Wrong legacy copy"},{term:"CPM",explanation:"Wrong legacy copy"},{term:"REACH (EST.)",explanation:"Duplicate"}],name!=="dark");
    expect(xml).toContain("METRIC ABBREVIATION GUIDE");
    expect(xml).toContain(metricDefinition("REACH"));
    expect(xml).toContain(metricDefinition("CPM"));
    expect(xml).not.toContain("Wrong legacy copy");
    expect(xml).not.toContain("LEARNING PHASE");
    expect(xml).not.toContain("CONVERSIONS");
    expect((xml.match(/<a:t>REACH<\/a:t>/g)||[])).toHaveLength(1);
  });
  it("distinguishes impressions, all clicks, link clicks and reach-based costs",()=>{
    expect(metricDefinition("CPC (ALL)")).toContain("all ad clicks");
    expect(metricDefinition("COST PER LINK CLICK")).toContain("link clicks");
    expect(metricDefinition("COST PER 1K REACH")).toContain("people reached");
    expect(metricDefinition("CPM")).toContain("impressions");
  });
  it("keeps one readable page and explicitly discloses overflow",async()=>{
    const template=await loadTemplate(fs.readFileSync("templates/dark.pptx"));
    const xml=buildLegendSlideXml(template.legend.xml,Array.from({length:16},(_,i)=>({term:`Metric ${i}`,explanation:`Definition ${i}`})));
    expect(xml).toContain("12 of 16 selected terms shown");
    expect(xml).toContain("nextreport.in/help/metrics");
    expect(xml).not.toContain("Metric 12</a:t>");
  });
  it("escapes metric text",async()=>{
    const template=await loadTemplate(fs.readFileSync("templates/dark.pptx"));
    expect(buildLegendSlideXml(template.legend.xml,[{term:"A & B",explanation:"<source>"}])).toContain("A &amp; B");
  });
});
