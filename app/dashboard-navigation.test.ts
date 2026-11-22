import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  dashboardRouteDestinations,
  isActiveDestination,
  quickAccessDestinations,
  unavailableDashboardDestinations,
  prospectiveStudentDestinations,
  workspaceDestinations,
} from "../components/layout/navigation";

function hasAppRoute(href: string): boolean {
  const routeDirectory = href === "/" ? "" : href.slice(1);
  return existsSync(path.join(process.cwd(), "app", routeDirectory, "page.tsx"));
}

describe("dashboard navigation destinations", () => {
  it("provides a restricted prospective-student navigation", () => {
    expect(prospectiveStudentDestinations.map(({ label, href }) => [label, href])).toEqual([
      ["Dashboard", "/"],
      ["My University", "/university"],
      ["Profile", "/profile"],
      ["Discover", "/university?tab=people"],
      ["Communities", "/communities"],
      ["Public Projects", "/projects"],
      ["Admissions", "/admissions"],
    ]);
    expect(prospectiveStudentDestinations.map(({ href }) => href).join(" ")).not.toContain("/academic-hub");
  });
  it("points every Quick Access card to an implemented App Router page", () => {
    expect(quickAccessDestinations.map(({ label, href }) => [label, href])).toEqual([
      ["Academic Hub", "/academic-hub"],
      ["Project Nexus", "/projects"],
      ["Communities", "/communities"],
      ["Mentorship", "/mentorship"],
      ["Career & Opportunities", "/opportunities"],
    ]);
    for (const module of quickAccessDestinations) expect(hasAppRoute(module.href)).toBe(true);
  });

  it("points each available workspace item to an implemented route", () => {
    const available = workspaceDestinations.filter((item) => item.href !== null);
    expect(available.map(({ label, href }) => [label, href])).toEqual([
      ["Dashboard", "/"],
      ["Profile", "/profile"],
      ["My University", "/university"],
      ["Academic Hub", "/academic-hub"],
      ["Project Nexus", "/projects"],
      ["Communities", "/communities"],
      ["Mentorship", "/mentorship"],
      ["Discover", "/opportunities"],
    ]);
    for (const item of available) expect(hasAppRoute(item.href!)).toBe(true);
  });

  it("marks destinations without pages unavailable instead of linking to placeholders", () => {
    const myUniversity = workspaceDestinations.find((item) => item.label === "My University");
    expect(myUniversity?.href).toBe("/university");
    expect(unavailableDashboardDestinations.notifications).toContain("not included");
    expect(workspaceDestinations.every((item) => item.href === null || item.href.startsWith("/"))).toBe(true);
  });

  it("keeps the active state on the current route and its nested pages", () => {
    expect(isActiveDestination("/", "/")).toBe(true);
    expect(isActiveDestination("/projects", "/projects")).toBe(true);
    expect(isActiveDestination("/projects/new", "/projects")).toBe(true);
    expect(isActiveDestination("/projects", "/communities")).toBe(false);
    expect(isActiveDestination("/academic-hub", "/")).toBe(false);
  });

  it("uses route destinations for the dashboard header and supporting panels", () => {
    for (const href of Object.values(dashboardRouteDestinations)) {
      expect(hasAppRoute(href)).toBe(true);
    }
  });
});
