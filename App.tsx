import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConsoleChatPreviewScreen } from './src/modules/dog/ConsoleChatPreviewScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <ConsoleChatPreviewScreen />
    </SafeAreaProvider>
  );
}
