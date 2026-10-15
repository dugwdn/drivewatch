import Constants from 'expo-constants';

export const API_URL: string = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? '';
export const EAS_PROJECT_ID: string | undefined = Constants.expoConfig?.extra?.eas?.projectId;
