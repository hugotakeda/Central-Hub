import { AnalogAudio } from '../components/AnalogAudio';
import { useGearStore } from '../store/useGearStore';
export default function AudioSetup(){
  const navigate=useGearStore(s=>s.navigate);
  return <><div className="page-title"><div><h1>Adicionar fone P2</h1><p>Escolha o modelo e a saída de áudio que ele utiliza.</p></div><button className="text-button" onClick={()=>navigate('home')}>Voltar aos dispositivos</button></div><AnalogAudio onClose={()=>navigate('home')}/></>;
}
