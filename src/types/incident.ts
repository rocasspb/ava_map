export interface IncidentData {
  valid_time: boolean;
  id: number;
  href: string;
  caaml: string;
  date: string;
  danger: {
    rating: {
      level: number;
    };
  };
  location: {
    name: string;
    elevation: number;
    longitude: number;
    latitude: number;
    slope_angle: number;
    aspect: {
      id: number;
      text: string;
    };
    country: {
      id: number;
      code: string;
      text: string;
    };
    region: {
      id: number;
      text: string;
    };
    subregion: {
      id: number;
      text: string;
    };
  };
}
