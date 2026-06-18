import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const DocumentsTab = ({ theme = {} }) => {
  // Default theme
  const defaultTheme = {
    textSecondary: theme.textSecondary || '#6b7280',
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: defaultTheme.textSecondary }]}>
        Documents is coming soon.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
  },
});

export default DocumentsTab;
