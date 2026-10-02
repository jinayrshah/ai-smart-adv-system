
export interface MarketPrice {
  id: string;
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  arrival_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  unit: string;
  trend: number; // percentage change
  history: { date: string; price: number }[];
}

export interface MarketFilters {
  state?: string;
  district?: string;
  commodity?: string;
}

export const marketService = {
  async getPrices(filters: MarketFilters = {}): Promise<MarketPrice[]> {

    try {
      const params = new URLSearchParams();
      if (filters.state && filters.state !== 'All States') params.append('state', filters.state);
      if (filters.district && filters.district !== 'All Districts') params.append('district', filters.district);
      if (filters.commodity) params.append('commodity', filters.commodity);

      const response = await fetch(`/api/market?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Backend market API failed');
      }
      
      const data = await response.json();
      
      if (!data.records || data.records.length === 0) {
        console.warn('[Market Service] No backend market records available');
        return [];
      }

      return data.records.map((record: any, index: number) => {
        const modalPrice = Number(record.modal_price);
        const arrivalDate = record.arrival_date || new Date().toISOString().split('T')[0];
        // Real reported point only; history trends are fetched from real database via marketApi /api/market/trend
        const history = [{ date: arrivalDate, price: modalPrice }];

        return {
          id: `${record.state}-${record.district}-${record.market}-${record.commodity}-${index}`,
          state: record.state,
          district: record.district,
          market: record.market,
          commodity: record.commodity,
          variety: record.variety,
          arrival_date: record.arrival_date,
          min_price: Number(record.min_price),
          max_price: Number(record.max_price),
          modal_price: modalPrice,
          unit: 'per quintal',
          trend: 0,
          history
        };
      });
    } catch (error) {
      console.error("Market Service Error:", error);
      return [];
    }
  },

  async getMarketInsight(params: { state: string, district: string, commodity: string }) {
    const query = new URLSearchParams({
      state: params.state,
      district: params.district,
      commodity: params.commodity
    });
    const response = await fetch(`/api/market/insight?${query.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch market insight');
    }
    return response.json();
  },

  getStates(): string[] {
    return [
      'All States',
      'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
      'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 
      'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 
      'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 
      'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
    ];
  },

  getDistricts(state?: string): string[] {
    // In a real app, we would fetch districts for the selected state
    // For now, we return a few common districts or fallback to mock
    if (!state || state === 'All States') {
      return ['All Districts', 'Bangalore', 'Ludhiana', 'Nashik', 'Agra', 'Warangal'];
    }
    
    const districtMap: Record<string, string[]> = {
      'Karnataka': ['Bangalore', 'Mysore', 'Hubli', 'Belgaum', 'Mangalore', 'Dharwad', 'Gulbarga', 'Bellary', 'Davangere'],
      'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Pathankot', 'Hoshiarpur', 'Moga', 'Mohali'],
      'Maharashtra': ['Mumbai', 'Pune', 'Nashik', 'Nagpur', 'Lasalgaon', 'Aurangabad', 'Solapur', 'Amravati', 'Nanded', 'Kolhapur'],
      'Uttar Pradesh': ['Agra', 'Lucknow', 'Kanpur', 'Varanasi', 'Meerut', 'Ghaziabad', 'Prayagraj', 'Bareilly', 'Aligarh'],
      'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam', 'Mahbubnagar', 'Nalgonda'],
      'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand'],
      'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Alwar', 'Bhilwara', 'Sikar'],
      'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam'],
    };

    return ['All Districts', ...(districtMap[state] || [])];
  }
};
