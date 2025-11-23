export interface CaamlData {
  bulletins: Bulletin[];
}

export interface Bulletin {
  publicationTime: string;
  validTime: {
    startTime: string;
    endTime: string;
  };
  avalancheActivity: {
    highlights: string;
    comment: string;
  };
  snowpackStructure: {
    comment: string;
  };
  tendency: Tendency[];
  avalancheProblems: AvalancheProblem[];
  dangerRatings: DangerRating[];
  regions: Region[];
  lang: string;
}

export interface Tendency {
  highlights: string;
  tendencyType: string;
  validTime: {
    startTime: string;
    endTime: string;
  };
}

export interface AvalancheProblem {
  problemType: string;
  elevation: {
    lowerBound?: string;
    upperBound?: string;
  };
  validTimePeriod: string;
  snowpackStability: string;
  frequency: string;
  avalancheSize: number;
  aspects: string[];
}

export interface DangerRating {
  mainValue: string;
  elevation: {
    lowerBound?: string;
    upperBound?: string;
  };
  validAspects?: string[];
  validTimePeriod: string;
}

export interface Region {
  name: string;
  regionID: string;
}
