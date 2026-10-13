/**
 * India State → Districts mapping with approximate lat/lon centroids.
 * Used for auto-fill in farm onboarding and location selectors.
 */

export interface DistrictGeo { name: string; lat: number; lon: number; }
export interface StateGeo { name: string; lat: number; lon: number; districts: DistrictGeo[]; }

export const INDIA_GEO: StateGeo[] = [
  { name: 'Andhra Pradesh', lat: 15.9129, lon: 79.74, districts: [
    { name: 'Guntur', lat: 16.3067, lon: 80.4365 }, { name: 'Krishna', lat: 16.6, lon: 80.7667 },
    { name: 'Kurnool', lat: 15.8281, lon: 78.0373 }, { name: 'Nellore', lat: 14.4426, lon: 79.9865 },
    { name: 'Visakhapatnam', lat: 17.6868, lon: 83.2185 }, { name: 'West Godavari', lat: 16.9174, lon: 81.3386 },
  ]},
  { name: 'Assam', lat: 26.2006, lon: 92.9376, districts: [
    { name: 'Kamrup', lat: 26.1445, lon: 91.7362 }, { name: 'Dibrugarh', lat: 27.4728, lon: 94.912 },
    { name: 'Jorhat', lat: 26.7465, lon: 94.2026 }, { name: 'Nagaon', lat: 26.3452, lon: 92.6836 },
  ]},
  { name: 'Bihar', lat: 25.0961, lon: 85.3131, districts: [
    { name: 'Patna', lat: 25.5941, lon: 85.1376 }, { name: 'Gaya', lat: 24.7964, lon: 85.0002 },
    { name: 'Muzaffarpur', lat: 26.1197, lon: 85.391 }, { name: 'Bhagalpur', lat: 25.2425, lon: 86.9842 },
    { name: 'Darbhanga', lat: 26.1542, lon: 85.8918 }, { name: 'Purnia', lat: 25.7771, lon: 87.4753 },
  ]},
  { name: 'Chhattisgarh', lat: 21.2787, lon: 81.8661, districts: [
    { name: 'Raipur', lat: 21.2514, lon: 81.6296 }, { name: 'Bilaspur', lat: 22.0796, lon: 82.1391 },
    { name: 'Durg', lat: 21.1904, lon: 81.2849 }, { name: 'Korba', lat: 22.3595, lon: 82.7501 },
  ]},
  { name: 'Gujarat', lat: 22.2587, lon: 71.1924, districts: [
    { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 }, { name: 'Surat', lat: 21.1702, lon: 72.8311 },
    { name: 'Vadodara', lat: 22.3072, lon: 73.1812 }, { name: 'Rajkot', lat: 22.3039, lon: 70.8022 },
    { name: 'Bhavnagar', lat: 21.7645, lon: 72.1519 }, { name: 'Junagadh', lat: 21.5222, lon: 70.4579 },
    { name: 'Kutch', lat: 23.7337, lon: 69.8597 }, { name: 'Anand', lat: 22.5645, lon: 72.9289 },
  ]},
  { name: 'Haryana', lat: 29.0588, lon: 76.0856, districts: [
    { name: 'Ambala', lat: 30.3782, lon: 76.7767 }, { name: 'Faridabad', lat: 28.4089, lon: 77.3178 },
    { name: 'Gurugram', lat: 28.4595, lon: 77.0266 }, { name: 'Hisar', lat: 29.1492, lon: 75.7217 },
    { name: 'Karnal', lat: 29.6857, lon: 76.9905 }, { name: 'Kurukshetra', lat: 29.9695, lon: 76.8783 },
    { name: 'Rohtak', lat: 28.8955, lon: 76.6066 }, { name: 'Sonipat', lat: 28.9931, lon: 77.0151 },
    { name: 'Panipat', lat: 29.3909, lon: 76.9635 }, { name: 'Sirsa', lat: 29.533, lon: 75.0167 },
  ]},
  { name: 'Karnataka', lat: 15.3173, lon: 75.7139, districts: [
    { name: 'Bengaluru Urban', lat: 12.9716, lon: 77.5946 }, { name: 'Mysuru', lat: 12.2958, lon: 76.6394 },
    { name: 'Dharwad', lat: 15.4589, lon: 75.0078 }, { name: 'Belagavi', lat: 15.8497, lon: 74.4977 },
    { name: 'Tumakuru', lat: 13.3379, lon: 77.1173 }, { name: 'Kalaburagi', lat: 17.3297, lon: 76.8343 },
    { name: 'Shivamogga', lat: 13.9299, lon: 75.5681 }, { name: 'Vijayapura', lat: 16.8302, lon: 75.71 },
  ]},
  { name: 'Kerala', lat: 10.8505, lon: 76.2711, districts: [
    { name: 'Thiruvananthapuram', lat: 8.5241, lon: 76.9366 }, { name: 'Ernakulam', lat: 9.9816, lon: 76.2999 },
    { name: 'Kozhikode', lat: 11.2588, lon: 75.7804 }, { name: 'Thrissur', lat: 10.5276, lon: 76.2144 },
    { name: 'Palakkad', lat: 10.7867, lon: 76.6548 }, { name: 'Kollam', lat: 8.8932, lon: 76.6141 },
  ]},
  { name: 'Madhya Pradesh', lat: 22.9734, lon: 78.6569, districts: [
    { name: 'Bhopal', lat: 23.2599, lon: 77.4126 }, { name: 'Indore', lat: 22.7196, lon: 75.8577 },
    { name: 'Jabalpur', lat: 23.1815, lon: 79.9864 }, { name: 'Gwalior', lat: 26.2183, lon: 78.1828 },
    { name: 'Ujjain', lat: 23.1793, lon: 75.7849 }, { name: 'Sagar', lat: 23.8388, lon: 78.7378 },
    { name: 'Dewas', lat: 22.9623, lon: 76.0536 }, { name: 'Ratlam', lat: 23.3324, lon: 75.0378 },
  ]},
  { name: 'Maharashtra', lat: 19.7515, lon: 75.7139, districts: [
    { name: 'Mumbai', lat: 19.076, lon: 72.8777 }, { name: 'Pune', lat: 18.5204, lon: 73.8567 },
    { name: 'Nashik', lat: 19.9975, lon: 73.7898 }, { name: 'Nagpur', lat: 21.1458, lon: 79.0882 },
    { name: 'Aurangabad', lat: 19.8762, lon: 75.3433 }, { name: 'Solapur', lat: 17.6599, lon: 75.9064 },
    { name: 'Kolhapur', lat: 16.705, lon: 74.2433 }, { name: 'Amravati', lat: 20.932, lon: 77.7523 },
    { name: 'Sangli', lat: 16.8524, lon: 74.5815 }, { name: 'Jalgaon', lat: 21.0077, lon: 75.5626 },
    { name: 'Ahmednagar', lat: 19.0948, lon: 74.748 }, { name: 'Satara', lat: 17.6805, lon: 74.0183 },
    { name: 'Latur', lat: 18.4088, lon: 76.5604 }, { name: 'Dhule', lat: 20.9042, lon: 74.7749 },
    { name: 'Nanded', lat: 19.1504, lon: 77.3152 }, { name: 'Ratnagiri', lat: 16.9902, lon: 73.3120 },
  ]},
  { name: 'Odisha', lat: 20.9517, lon: 85.0985, districts: [
    { name: 'Bhubaneswar', lat: 20.2961, lon: 85.8245 }, { name: 'Cuttack', lat: 20.4625, lon: 85.883 },
    { name: 'Sambalpur', lat: 21.4669, lon: 83.9812 }, { name: 'Berhampur', lat: 19.315, lon: 84.7941 },
    { name: 'Rourkela', lat: 22.2604, lon: 84.8536 }, { name: 'Balasore', lat: 21.4942, lon: 86.932 },
  ]},
  { name: 'Punjab', lat: 31.1471, lon: 75.3412, districts: [
    { name: 'Amritsar', lat: 31.634, lon: 74.8723 }, { name: 'Ludhiana', lat: 30.901, lon: 75.8573 },
    { name: 'Jalandhar', lat: 31.326, lon: 75.5762 }, { name: 'Patiala', lat: 30.3398, lon: 76.3869 },
    { name: 'Sangrur', lat: 30.2457, lon: 75.8443 }, { name: 'Bathinda', lat: 30.211, lon: 74.9455 },
    { name: 'Ferozepur', lat: 30.9233, lon: 74.6226 }, { name: 'Moga', lat: 30.8154, lon: 75.1728 },
    { name: 'Gurdaspur', lat: 32.038, lon: 75.4022 }, { name: 'Kapurthala', lat: 31.381, lon: 75.3836 },
  ]},
  { name: 'Rajasthan', lat: 27.0238, lon: 74.2179, districts: [
    { name: 'Jaipur', lat: 26.9124, lon: 75.7873 }, { name: 'Jodhpur', lat: 26.2389, lon: 73.0243 },
    { name: 'Kota', lat: 25.2138, lon: 75.8648 }, { name: 'Bikaner', lat: 28.0229, lon: 73.3119 },
    { name: 'Udaipur', lat: 24.5854, lon: 73.7125 }, { name: 'Ajmer', lat: 26.4499, lon: 74.6399 },
    { name: 'Alwar', lat: 27.553, lon: 76.6346 }, { name: 'Sikar', lat: 27.6094, lon: 75.1399 },
    { name: 'Nagaur', lat: 27.2036, lon: 73.7286 }, { name: 'Sri Ganganagar', lat: 29.9089, lon: 73.8763 },
  ]},
  { name: 'Tamil Nadu', lat: 11.1271, lon: 78.6569, districts: [
    { name: 'Chennai', lat: 13.0827, lon: 80.2707 }, { name: 'Coimbatore', lat: 11.0168, lon: 76.9558 },
    { name: 'Madurai', lat: 9.9252, lon: 78.1198 }, { name: 'Tiruchirappalli', lat: 10.7905, lon: 78.7047 },
    { name: 'Salem', lat: 11.6643, lon: 78.146 }, { name: 'Tirunelveli', lat: 8.7139, lon: 77.7567 },
    { name: 'Erode', lat: 11.341, lon: 77.7172 }, { name: 'Thanjavur', lat: 10.787, lon: 79.1378 },
  ]},
  { name: 'Telangana', lat: 17.1232, lon: 79.2088, districts: [
    { name: 'Hyderabad', lat: 17.385, lon: 78.4867 }, { name: 'Warangal', lat: 17.9689, lon: 79.5941 },
    { name: 'Nizamabad', lat: 18.6725, lon: 78.0941 }, { name: 'Karimnagar', lat: 18.4386, lon: 79.1288 },
    { name: 'Khammam', lat: 17.2473, lon: 80.1514 }, { name: 'Nalgonda', lat: 17.0575, lon: 79.2674 },
    { name: 'Medak', lat: 18.0453, lon: 78.2607 }, { name: 'Mahabubnagar', lat: 16.7371, lon: 78.0037 },
  ]},
  { name: 'Uttar Pradesh', lat: 26.8467, lon: 80.9462, districts: [
    { name: 'Lucknow', lat: 26.8467, lon: 80.9462 }, { name: 'Agra', lat: 27.1767, lon: 78.0081 },
    { name: 'Kanpur', lat: 26.4499, lon: 80.3319 }, { name: 'Prayagraj', lat: 25.4358, lon: 81.8463 },
    { name: 'Varanasi', lat: 25.3176, lon: 82.9739 }, { name: 'Meerut', lat: 28.9845, lon: 77.7064 },
    { name: 'Bareilly', lat: 28.367, lon: 79.4304 }, { name: 'Gorakhpur', lat: 26.7606, lon: 83.3732 },
    { name: 'Mathura', lat: 27.4924, lon: 77.6737 }, { name: 'Aligarh', lat: 27.8974, lon: 78.088 },
    { name: 'Muzaffarnagar', lat: 29.4737, lon: 77.7043 }, { name: 'Moradabad', lat: 28.8386, lon: 78.7733 },
  ]},
  { name: 'Uttarakhand', lat: 30.0668, lon: 79.0193, districts: [
    { name: 'Dehradun', lat: 30.3165, lon: 78.0322 }, { name: 'Haridwar', lat: 29.9457, lon: 78.1642 },
    { name: 'Nainital', lat: 29.3803, lon: 79.4636 }, { name: 'Udham Singh Nagar', lat: 28.9935, lon: 79.5143 },
    { name: 'Almora', lat: 29.5971, lon: 79.659 },
  ]},
  { name: 'West Bengal', lat: 22.9868, lon: 87.855, districts: [
    { name: 'Kolkata', lat: 22.5726, lon: 88.3639 }, { name: 'Howrah', lat: 22.5958, lon: 88.2636 },
    { name: 'Bardhaman', lat: 23.2324, lon: 87.8615 }, { name: 'Murshidabad', lat: 24.1783, lon: 88.2713 },
    { name: 'Nadia', lat: 23.4733, lon: 88.559 }, { name: 'North 24 Parganas', lat: 22.8587, lon: 88.4975 },
    { name: 'Malda', lat: 25.0108, lon: 88.1414 }, { name: 'Jalpaiguri', lat: 26.5447, lon: 88.7179 },
  ]},
];

export function getDistrictsByState(stateName: string): DistrictGeo[] {
  return INDIA_GEO.find(s => s.name === stateName)?.districts ?? [];
}
export function getStateLatLon(stateName: string): { lat: number; lon: number } | null {
  const s = INDIA_GEO.find(st => st.name === stateName);
  return s ? { lat: s.lat, lon: s.lon } : null;
}
export function getDistrictLatLon(stateName: string, districtName: string): { lat: number; lon: number } | null {
  const state = INDIA_GEO.find(s => s.name === stateName);
  if (!state) return null;
  const dist = state.districts.find(d => d.name === districtName);
  return dist ? { lat: dist.lat, lon: dist.lon } : null;
}
