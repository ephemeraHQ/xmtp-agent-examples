#!/bin/bash
# XMTP Agent Manager Script
# This script handles running, logging, and managing XMTP agents

# Usage function
show_usage() {
  echo "XMTP Agent Manager"
  echo "Usage:"
  echo "  $0 start                                        # Start the agent with logging"
  echo "  $0 stop                                         # Stop the running agent"
  echo "  $0 status                                       # Check agent status"
  echo "  $0 logs                                         # Show agent logs"
  echo "  $0 send <network> <target_address> \"<message>\"  # Send a test message to an agent"
  echo "  $0 help                                         # Show this help message"
}

# Set working directory to the current directory
AGENT_DIR=$(pwd)
LOG_FILE="$AGENT_DIR/agent.log"
PID_FILE="$AGENT_DIR/agent.pid"

# Start agent function
start_agent() {
  # Check if agent is already running
  if [ -f "$PID_FILE" ] && ps -p $(cat "$PID_FILE") > /dev/null; then
    echo "Agent is already running with PID $(cat "$PID_FILE")"
    return 1
  fi

  echo "Starting agent in $AGENT_DIR"
  echo "Logs will be saved to $LOG_FILE"
  
  # Start the agent with output redirected to log file
  yarn dev > "$LOG_FILE" 2>&1 &
  
  # Save PID
  echo $! > "$PID_FILE"
  
  # Verify it started
  if ps -p $(cat "$PID_FILE") > /dev/null; then
    echo "Agent started successfully with PID $(cat "$PID_FILE")"
    echo "Waiting for agent initialization..."
    
    # Wait for log file to contain initialization message or timeout after 15 seconds
    timeout=15
    while [ $timeout -gt 0 ]; do
      if grep -q "Waiting for messages" "$LOG_FILE" || grep -q "Agent Details" "$LOG_FILE"; then
        echo "Agent initialized successfully!"
        echo "Agent address and details:"
        grep -A 8 "Agent Details" "$LOG_FILE"
        return 0
      fi
      sleep 1
      timeout=$((timeout-1))
    done
    
    echo "Agent started but initialization not confirmed. Check logs for details."
    return 0
  else
    echo "Failed to start agent. Check for errors."
    return 1
  fi
}

# Stop agent function
stop_agent() {
  if [ ! -f "$PID_FILE" ]; then
    echo "No PID file found, agent may not be running"
    return 1
  fi
  
  PID=$(cat "$PID_FILE")
  if ps -p $PID > /dev/null; then
    echo "Stopping agent with PID $PID"
    kill $PID
    
    # Wait for process to terminate
    timeout=5
    while [ $timeout -gt 0 ] && ps -p $PID > /dev/null; do
      echo "Waiting for agent to terminate..."
      sleep 1
      timeout=$((timeout-1))
    done
    
    if ps -p $PID > /dev/null; then
      echo "Agent did not terminate gracefully, forcing termination"
      kill -9 $PID
    fi
    
    echo "Agent stopped"
  else
    echo "No running agent found with PID $PID"
  fi
  
  # Remove PID file
  rm -f "$PID_FILE"
  return 0
}

# Check agent status
check_status() {
  if [ ! -f "$PID_FILE" ]; then
    echo "No PID file found, agent is not running"
    return 1
  fi
  
  PID=$(cat "$PID_FILE")
  if ps -p $PID > /dev/null; then
    echo "Agent is running with PID $PID"
    echo "Log file: $LOG_FILE ($(du -h "$LOG_FILE" | cut -f1) used)"
    
    # Show process details
    echo "Process details:"
    ps -p $PID -o pid,ppid,user,%cpu,%mem,vsz,rss,tty,stat,start,time,command
    
    # Show recent log entries
    echo "Recent log entries:"
    tail -5 "$LOG_FILE"
    return 0
  else
    echo "PID file exists but agent is not running (PID $PID)"
    echo "Log file: $LOG_FILE ($(du -h "$LOG_FILE" | cut -f1) used)"
    return 1
  fi
}

# Show logs
show_logs() {
  if [ ! -f "$LOG_FILE" ]; then
    echo "No log file found at $LOG_FILE"
    return 1
  fi
  
  echo "Showing log file: $LOG_FILE"
  echo "Press Ctrl+C to exit"
  tail -f "$LOG_FILE"
}

# Send test message function
send_test_message() {
  if [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ]; then
    echo "Error: Missing required parameters"
    echo "Usage: $0 send <network> <target_address> \"<message>\""
    return 1
  fi

  NETWORK=$2
  TARGET_ADDRESS=$3
  MESSAGE=$4

  echo "Sending test message using test-cli..."
  echo "Network: $NETWORK"
  echo "Target Address: $TARGET_ADDRESS"
  echo "Message: $MESSAGE"
  
  # Call the test-cli.ts script with the provided arguments
  tsx ../../scripts/test-cli.ts "$NETWORK" "$TARGET_ADDRESS" "$MESSAGE"
  return $?
}

# Main command handling
case "$1" in
  start)
    start_agent
    ;;
  stop)
    stop_agent
    ;;
  status)
    check_status
    ;;
  logs)
    show_logs
    ;;
  send)
    send_test_message "$@"
    ;;
  help|--help|-h)
    show_usage
    ;;
  *)
    echo "Unknown command: $1"
    show_usage
    exit 1
    ;;
esac