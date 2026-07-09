import { useEffect } from 'react';
import { Linking } from 'react-native';
import { getSocket } from '../services/socket';

export const useIncomingCallTrigger = () => {
  useEffect(() => {
    let socket = getSocket();
    // console.log("🟢 [MOBILE] Hook mounted. Socket:", socket);

    if (!socket) {
      // console.log("🔴 [MOBILE] Socket not ready yet, retrying in 1s...");
      const retryInterval = setInterval(() => {
        socket = getSocket();
        if (socket) {
          // console.log("🟢 [MOBILE] Socket found on retry:", socket.id);
          clearInterval(retryInterval);
          attachListener(socket);
        }
      }, 1000);

      return () => clearInterval(retryInterval);
    }

    attachListener(socket);

    function attachListener(sock) {
      // console.log("🟢 [MOBILE] Attaching incoming-call-trigger listener");
      
      const handler = ({ phoneNumber, leadName }) => {
        // console.log("🟢 [MOBILE] Received incoming-call-trigger:", phoneNumber, leadName);
        if (phoneNumber) {
          Linking.openURL(`tel:${phoneNumber}`);
        }
      };

      sock.on('incoming-call-trigger', handler);

      return () => sock.off('incoming-call-trigger', handler);
    }
  }, []);
};