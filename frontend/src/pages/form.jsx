import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Form() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    floors: '',
    style: '',
    budget: '',
    location: '',
    features: [],
    additional: '',
    cadAssets: {} // New: stores selected CAD assets by room
  });

  const styleOptions = ['Modern', 'Contemporary', 'Traditional', 'Minimalist', 'Industrial', 'Scandinavian'];
  const featureOptions = [
    'Open Kitchen',
    'Home Office',
    'Walk-in Closet',
    'Laundry Room',
    'Garage',
    'Balcony',
    'Garden',
    'Pool',
    'Gym',
    'Smart Home'
  ];

  // CAD Assets organized by room type
  const cadAssetsByRoom = {
    'Bedroom': ['Bed', 'Nightstand', 'Wardrobe', 'Dresser', 'Study Desk', 'Chair', 'Mirror'],
    'Kitchen': ['Refrigerator', 'Stove', 'Dishwasher', 'Kitchen Island', 'Dining Table', 'Cabinets', 'Sink'],
    'Living Room': ['Sofa', 'Coffee Table', 'TV Unit', 'Armchair', 'Bookshelf', 'Side Table', 'Entertainment Center'],
    'Bathroom': ['Toilet', 'Sink', 'Shower', 'Bathtub', 'Vanity', 'Mirror Cabinet', 'Towel Rack'],
    'Dining Room': ['Dining Table', 'Dining Chairs', 'Buffet', 'China Cabinet', 'Chandelier'],
    'Home Office': ['Desk', 'Office Chair', 'Filing Cabinet', 'Bookshelf', 'Printer Stand']
  };

  const toggleFeature = (feature) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  // New function to toggle CAD assets
  const toggleCADAsset = (room, asset) => {
    setFormData(prev => {
      const currentAssets = prev.cadAssets[room] || [];
      return {
        ...prev,
        cadAssets: {
          ...prev.cadAssets,
          [room]: currentAssets.includes(asset)
            ? currentAssets.filter(a => a !== asset)
            : [...currentAssets, asset]
        }
      };
    });
  };

  const handleSubmit = () => {
    // Build CAD assets text for the prompt
    const cadAssetsText = Object.entries(formData.cadAssets)
      .filter(([_, assets]) => assets.length > 0)
      .map(([room, assets]) => `${room}: ${assets.join(', ')}`)
      .join('; ');

    const prompt = `Design a ${formData.style || 'modern'} house with ${formData.bedrooms} bedrooms, ${formData.bathrooms} bathrooms, ${formData.sqft} sqft${formData.floors ? `, ${formData.floors} floors` : ''}. Features: ${formData.features.join(', ') || 'standard features'}. ${cadAssetsText ? `Include these CAD assets - ${cadAssetsText}.` : ''} ${formData.additional}`;
    
    navigate('/chat', { state: { prompt, formData } });
  };

  return (
    <div className="min-h-screen px-6 py-12 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <img 
            src="/clairvyn-logo.png" 
            alt="Clairvyn" 
            className="h-16 mx-auto mb-6"
          />
          <h1 className="text-5xl font-bold tracking-tight text-gray-900">
            Design Your Dream Space
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Answer a few questions to generate your perfect floor plan with AI
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-blue-500/10 p-8 md:p-12 border border-gray-100">
          <div className="space-y-10">
            
            {/* Basic Specifications */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Basic Specifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bedrooms *
                  </label>
                  <input
                    type="number"
                    value={formData.bedrooms}
                    onChange={(e) => setFormData({...formData, bedrooms: e.target.value})}
                    placeholder="3"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bathrooms *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.bathrooms}
                    onChange={(e) => setFormData({...formData, bathrooms: e.target.value})}
                    placeholder="2"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Square Feet *
                  </label>
                  <input
                    type="number"
                    value={formData.sqft}
                    onChange={(e) => setFormData({...formData, sqft: e.target.value})}
                    placeholder="2000"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Floors
                  </label>
                  <input
                    type="number"
                    value={formData.floors}
                    onChange={(e) => setFormData({...formData, floors: e.target.value})}
                    placeholder="1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>

            {/* CAD Assets Selection - Shows when bedrooms are selected */}
            {formData.bedrooms && (
              <div className="bg-blue-50 rounded-2xl p-8 border-2 border-blue-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Select CAD Assets for Each Room
                </h3>
                <p className="text-gray-600 mb-6">
                  Choose the furniture and fixtures you want in each room to avoid unwanted items
                </p>

                <div className="space-y-6">
                  {Object.entries(cadAssetsByRoom).map(([room, assets]) => (
                    <div key={room} className="bg-white rounded-xl p-6 shadow-sm">
                      <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">
                          {formData.cadAssets[room]?.length || 0}
                        </span>
                        {room}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {assets.map(asset => (
                          <button
                            key={asset}
                            onClick={() => toggleCADAsset(room, asset)}
                            className={`py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                              formData.cadAssets[room]?.includes(asset)
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                            }`}
                          >
                            {asset}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Design Style */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Design Style</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {styleOptions.map(style => (
                  <button
                    key={style}
                    onClick={() => setFormData({...formData, style})}
                    className={`py-3 px-4 rounded-xl font-medium transition-all ${
                      formData.style === style
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 scale-105'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Features & Amenities */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Features & Amenities</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {featureOptions.map(feature => (
                  <button
                    key={feature}
                    onClick={() => toggleFeature(feature)}
                    className={`py-3 px-4 rounded-xl font-medium transition-all ${
                      formData.features.includes(feature)
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {feature}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget & Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Budget Range
                </label>
                <select
                  value={formData.budget}
                  onChange={(e) => setFormData({...formData, budget: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                >
                  <option value="">Select budget range</option>
                  <option value="under-200k">Under $200,000</option>
                  <option value="200k-400k">$200,000 - $400,000</option>
                  <option value="400k-600k">$400,000 - $600,000</option>
                  <option value="600k-800k">$600,000 - $800,000</option>
                  <option value="over-800k">Over $800,000</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Location/Climate
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="e.g., Sunny California, Cold Northeast"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Additional Requirements */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Additional Requirements or Preferences
              </label>
              <textarea
                value={formData.additional}
                onChange={(e) => setFormData({...formData, additional: e.target.value})}
                placeholder="Describe any specific needs: accessibility features, natural lighting preferences, outdoor spaces, sustainable materials, etc."
                className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition h-32 resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                onClick={handleSubmit}
                disabled={!formData.bedrooms || !formData.bathrooms || !formData.sqft}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-lg font-bold hover:shadow-2xl hover:shadow-blue-500/50 transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                Generate Floor Plan with AI
              </button>
              <p className="text-sm text-gray-500 text-center mt-3">
                * Required fields
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}