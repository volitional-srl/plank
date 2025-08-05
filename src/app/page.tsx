import PolygonDrawer from '../components/PolygonDrawer';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Plank - Parquet Floor Layout Calculator</h1>
          <p className="text-gray-600 mt-1">Draw your surface to get started with your floor layout</p>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border h-[calc(100vh-200px)]">
          <PolygonDrawer />
        </div>
      </main>
    </div>
  );
}
