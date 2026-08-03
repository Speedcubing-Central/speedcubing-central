import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BattleLobbyScreen from '../features/battle/BattleLobbyScreen';
import BattleRoomScreen from '../features/battle/BattleRoomScreen';

// The Battle tab is a two-screen stack, the same shape as the web's two routes
// (`/battle` and `/battle/:code`). The room's parameters are what the web
// carries in its router state: the code identifies the room, and the name and
// password are what `join_room` needs to get into it.
//
// The room hides its own header. It runs a timer, so it needs the column the way
// the Timer screen does, and a stack header would take a fixed slice off the top
// of it for a title the room already prints itself. Leaving is an explicit
// control in its own header row instead, which also lets it send `leave_room`
// on the way out rather than just popping the screen.
export type BattleStackParamList = {
  BattleLobby: undefined;
  BattleRoom: { code: string; displayName?: string; password?: string };
};

const Stack = createNativeStackNavigator<BattleStackParamList>();

export function BattleStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BattleLobby" component={BattleLobbyScreen} options={{ title: 'Battle' }} />
      <Stack.Screen name="BattleRoom" component={BattleRoomScreen} options={{ title: 'Room' }} />
    </Stack.Navigator>
  );
}
