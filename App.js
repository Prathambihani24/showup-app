import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import HomeScreen from './screens/HomeScreen';
import CreatePlanScreen from './screens/CreatePlanScreen';
import ProfileScreen from './screens/ProfileScreen';
import FavoritesScreen from './screens/FavoritesScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_ICONS = {
  Home: { icon: '⚡', label: 'explore' },
  Create: { icon: '＋', label: 'drop' },
  Favorites: { icon: '♡', label: 'saved' },
  Profile: { icon: '◯', label: 'me' },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F0F0F0',
          borderTopWidth: 1,
          paddingBottom: 20,
          paddingTop: 12,
          height: 80,
          elevation: 0,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: -4 },
          shadowRadius: 20,
        },
        tabBarActiveTintColor: '#7C3AED',
        tabBarInactiveTintColor: '#C4C4C4',
        tabBarIcon: ({ focused }) => (
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: focused ? '#F3EEFF' : 'transparent',
          }}>
            <Text style={{
              fontSize: focused ? 20 : 18,
              color: focused ? '#7C3AED' : '#C4C4C4',
            }}>
              {TAB_ICONS[route.name].icon}
            </Text>
          </View>
        ),
        tabBarLabel: ({ focused }) => (
          <Text style={{
            fontSize: 10,
            fontWeight: '700',
            color: focused ? '#7C3AED' : '#C4C4C4',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginTop: -4,
          }}>
            {TAB_ICONS[route.name].label}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Create" component={CreatePlanScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  // Bypass auth - go straight to MainTabs for UI development
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <MainTabs />
    </NavigationContainer>
  );
}