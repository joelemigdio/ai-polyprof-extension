import { useEffect, useState } from "react";
import type { Professor } from "../models/professor";
import { mockProfessorDataService } from "../services/mock-professor-data-service";
import { ProfessorResults } from "./ProfessorResults";
import { ProfessorDetails } from "./ProfessorDetails";

export function App() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfessor, setSelectedProfessor] = useState<Professor | null>(null);

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
        <h1>{selectedProfessor ? "Professor Details" : "Professor Results"}</h1>
        <p className="intro">The extension is installed and using clearly labeled demonstration data.</p>
      </header>

      {isLoading ? <p>Loading professor results…</p> : null}
      {!isLoading && !selectedProfessor ? (
        <ProfessorResults professors={professors} onViewDetails={setSelectedProfessor} />
      ) : null}

      {selectedProfessor ? (
        <ProfessorDetails professor={selectedProfessor} onBack={() => setSelectedProfessor(null)} />
      ) : null}
    </main>
  );
}
