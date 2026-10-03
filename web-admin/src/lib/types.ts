/** Shapes the backend returns, shared by the web-admin pages. */

export interface FarmUser {
  id: string;
  username: string;
  full_name: string;
  region: string | null;
  role: string;
  is_active?: boolean;
}

export interface WeatherDay {
  date: string;
  summary: string;
  icon: string;
  temp_max: number | null;
  temp_min: number | null;
  temp_mean: number | null;
  precipitation_sum: number | null;
  precipitation_probability: number | null;
  wind_speed_max: number | null;
}

export interface WeatherAlert {
  id: string;
  date: string;
  kind: "mua_to" | "mua_rat_to" | "ret_hai";
  level: "warning" | "danger";
  title: string;
  body: string;
  expires_at: number;
}

export interface Forecast {
  place: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  fetched_at: number;
  stale: boolean;
  current: {
    time: string | null;
    temperature: number | null;
    humidity: number | null;
    precipitation: number | null;
    wind_speed: number | null;
    is_day: boolean;
    summary: string;
    icon: string;
  };
  daily: WeatherDay[];
  alerts: WeatherAlert[];
  source: {name: string; url: string; licence: string};
  basis: string;
  raised?: string[];
}

export interface AppNotice {
  id: string;
  owner_id: string | null;
  audience_label: string;
  kind: "announcement" | "weather" | "price" | string;
  level: "info" | "warning" | "danger" | string;
  title: string;
  body: string;
  link: string | null;
  source_name: string | null;
  source_url: string | null;
  expires_at: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
  read: boolean;
  read_count: number | null;
  audience_size: number | null;
}

export interface Overview {
  year: number;
  month: number;
  farms_total: number;
  farms_active: number;
  plots: number;
  area_m2: number;
  month_income: number;
  month_expense: number;
  stock_value: number;
  pending_tasks: number;
  varieties_pending: number;
  errors_7d: number;
  months: {year: number; month: number; income: number; expense: number}[];
  crops: {crop_type: string; crop_name: string; plots: number; area_m2: number}[];
  farms: {
    id: string;
    username: string;
    full_name: string;
    region: string | null;
    is_active: boolean;
    plots: number;
    area_m2: number;
    month_income: number;
    month_expense: number;
    stock_value: number;
    pending_tasks: number;
    last_activity: number | null;
  }[];
}

export interface PlotRow {
  id: string;
  code: string;
  name: string;
  region: string | null;
  area: number;
  area_unit: string;
  crop_type: string;
  crop_name: string | null;
  variety_id: string | null;
  variety_name: string | null;
  planted_at: number | null;
  status: string;
  notes: string | null;
  owner_id: string;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface ErrorLogRow {
  id: string;
  user_id: string;
  action: string;
  message: string;
  stack: string | null;
  app_version: string | null;
  platform: string | null;
  occurred_at: number;
  reported: boolean;
  created_at?: number;
}
