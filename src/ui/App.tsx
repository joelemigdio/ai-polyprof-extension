import { useEffect, useState } from "react";
import type { Professor } from "../models/professor";
import { mockProfessorDataService } from "../services/mock-professor-data-service";
import { ProfessorResults } from "./ProfessorResults";
import { ProfessorDetails } from "./ProfessorDetails";
import { StudentPreferences } from "./StudentPreferences";

type View = "results" | "details" | "preferences";

export function App() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfessor, setSelectedProfessor] = useState<Professor | null>(null);
  const [view, setView] = useState<View>("results");

  useEffect(() => {
    void mockProfessorDataService.getProfessorResults().then((results) => {
      setProfessors(results);
      setIsLoading(false);
    });
  }, []);

  return (
    <main className="popup-shell">
      <header>
        <p className="eyebrow">AI POLYRATINGS · ALPHA FOUNDATION</p>
        <h1>{view === "details" ? "Professor Details" : view === "preferences" ? "Preferences" : "Professor Results"}</h1>
        <p className="intro">The extension is installed and using clearly labeled demonstration data.</p>
      </header>

      {isLoading ? <p>Loading professor results…</p> : null}
      {!isLoading && view === "results" ? (
        <ProfessorResults
          professors={professors}
          onViewDetails={(professor) => { setSelectedProfessor(professor); setView("details"); }}
          onOpenPreferences={() => setView("preferences")}
        />
      ) : null}

      {view === "details" && selectedProfessor ? (
        <ProfessorDetails professor={selectedProfessor} onBack={() => setView("results")} />
      ) : null}

      {view === "preferences" ? <StudentPreferences onBack={() => setView("results")} /> : null}
    </main>
  );
}
