import {
  buildBlankSlideXml,
  resetShapeIdCounter,
  roundedCard,
  textBox,
  nextShapeId,
  rectangle,
} from "./shapes";
import { buildPictureShapeXml, fitContainEmu } from "./embed-image";
import { slideSurfacePalette } from "./slide-surface-palette";
import type { LoadedTemplate, SlideToInsert } from "./package";
import type { MetaContentPresentation } from "../nre/meta-report-content/types";
import {
  metaPageTable,
  metaPreviewMetrics,
} from "../nre/meta-report-content/format";
import { escapeXmlText } from "./ooxml";
export function appendMetaContentSlides(
  template: LoadedTemplate,
  slides: SlideToInsert[],
  content: MetaContentPresentation | undefined,
  light = false,
) {
  if (!content) return;
  for (const [index, page] of content.pages.entries()) {
    if (page.visible === false) continue;
    resetShapeIdCounter();
    const palette = slideSurfacePalette(light);
    const shapes = [
      rectangle({
        x: 0,
        y: 0,
        w: 960,
        h: 540,
        fillHex: light ? "F8FAFC" : "0D142B",
      }),
      ...Array.from({ length: 11 }, (_, i) =>
        rectangle({
          x: (i + 1) * 80,
          y: 0,
          w: 0.4,
          h: 540,
          fillHex: light ? "E6EBF2" : "18223A",
        }),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        rectangle({
          x: 0,
          y: (i + 1) * 60,
          w: 960,
          h: 0.4,
          fillHex: light ? "E6EBF2" : "18223A",
        }),
      ),
      textBox({
        x: 40,
        y: 25,
        w: 880,
        h: 58,
        text:
          page.title.length > 115 ? page.title.slice(0, 112) + "…" : page.title,
        sizePt: 25,
        bold: true,
        colorHex: palette.heading,
      }),
      textBox({
        x: 40,
        y: 88,
        w: 880,
        h: 29,
        text: `${page.dateLabel} · ${page.objective.length > 95 ? page.objective.slice(0, 92) + "…" : page.objective}`,
        sizePt: 14,
        colorHex: palette.text,
      }),
    ];
    let imageRel = "";
    if (page.kind === "creative-preview") {
      const row = page.rows[0],
        image = content.media[row.adId ?? ""];
      shapes.push(
        roundedCard({
          x: 40,
          y: 138,
          w: 425,
          h: 310,
          fillHex: palette.cardFill,
          strokeHex: palette.cardStroke,
          radiusPt: 8,
        }),
      );
      if (image) {
        const file = `meta-content-${index}.jpeg`;
        template.staticFiles.set(
          `ppt/media/${file}`,
          Buffer.from(image.data.split(",")[1], "base64"),
        );
        if (!template.contentTypesXml.includes('Extension="jpeg"'))
          template.contentTypesXml = template.contentTypesXml.replace(
            "</Types>",
            '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>',
          );
        const fit = fitContainEmu(
          image.width,
          image.height,
          405 * 12700,
          290 * 12700,
        );
        shapes.push(
          buildPictureShapeXml({
            id: nextShapeId(),
            name: `Creative ${row.adId}`,
            relId: "rIdMetaImage",
            x: 40 * 12700 + (425 * 12700 - fit.cx) / 2,
            y: 138 * 12700 + (310 * 12700 - fit.cy) / 2,
            cx: fit.cx,
            cy: fit.cy,
          }),
        );
        imageRel = `<Relationship Id="rIdMetaImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${file}"/>`;
      }
      const metrics = metaPreviewMetrics(row, page, content.currencySymbol);
      metrics.forEach(([label, value], i) => {
        const x = 490 + (i % 2) * 215,
          y = 138 + Math.floor(i / 2) * 77;
        shapes.push(
          textBox({
            x,
            y,
            w: 205,
            h: 32,
            text: label,
            sizePt: 12,
            bold: true,
            colorHex: palette.label,
          }),
          textBox({
            x,
            y: y + 31,
            w: 205,
            h: 33,
            text: value,
            sizePt: 21,
            bold: true,
            colorHex: palette.heading,
          }),
        );
      });
      shapes.push(
        textBox({
          x: 40,
          y: 451,
          w: 880,
          h: 22,
          text: `Ad ID: ${row.adId} · ${row.campaign ?? ""}`,
          sizePt: 11,
          colorHex: palette.label,
        }),
      );
    } else {
      if (page.insight)
        shapes.push(
          textBox({
            x: 40,
            y: 115,
            w: 880,
            h: 28,
            text: page.insight,
            sizePt: 12,
            colorHex: palette.text,
          }),
        );
      const grid = metaPageTable(page, content.currencySymbol),
        widths = [
          260,
          ...Array(grid[0].length - 1).fill(620 / (grid[0].length - 1)),
        ];
      grid.forEach((row, r) => {
        let x = 40;
        const y = r === 0 ? 148 : 198 + (r - 1) * 34;
        if (r === 0 || r % 2 === 0)
          shapes.push(
            rectangle({
              x: 40,
              y: y - 3,
              w: 880,
              h: r === 0 ? 43 : 32,
              fillHex: r === 0 ? palette.cardStroke : palette.cardFill,
            }),
          );
        row.forEach((value, c) => {
          shapes.push(
            textBox({
              x: x + 5,
              y,
              w: widths[c] - 10,
              h: r === 0 ? 49 : 31,
              text:
                r === 0 && value.length > 28 ? value.slice(0, 25) + "…" : value,
              sizePt: r === 0 ? 12 : c === 0 && value.length > 70 ? 10 : 13,
              bold: r === 0,
              colorHex: r === 0 ? palette.heading : palette.text,
              align: c === 0 ? "l" : "ctr",
            }),
          );
          if (r > 0 && c === 1) {
            const max = Math.max(...page.rows.map((row) => row.spend), 1);
            shapes.push(
              rectangle({
                x: x + 5,
                y: y + 29,
                w: Math.max(
                  1,
                  ((widths[c] - 10) * page.rows[r - 1].spend) / max,
                ),
                h: 2,
                fillHex: "63B3ED",
              }),
            );
          }
          x += widths[c];
        });
      });
      if (!page.rows.length)
        shapes.push(
          textBox({
            x: 40,
            y: 212,
            w: 880,
            h: 90,
            text: "No source observations for these campaigns and dates.",
            sizePt: 18,
            colorHex: palette.text,
          }),
        );
    }
    shapes.push(
      textBox({
        x: 40,
        y: 480,
        w: 880,
        h: 45,
        text: page.note,
        sizePt: 10,
        colorHex: palette.label,
      }),
    );
    slides.push({
      xml: buildBlankSlideXml(shapes),
      rels: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${escapeXmlText(template.background.mediaTarget)}"/>${imageRel}</Relationships>`,
    });
  }
}
