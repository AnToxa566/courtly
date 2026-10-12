import { healthSchema, type Health } from '@courtly/contracts';

const sample: Health = healthSchema.parse({ status: 'ok' });

function App() {
  return <h1>Courtly — contracts: {sample.status}</h1>;
}

export default App;
