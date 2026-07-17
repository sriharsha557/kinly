import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Today: undefined;
  Circle: undefined;
  Goals: undefined;
  Connection: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  CircleSettings: undefined;
  EditProfile: undefined;
};
