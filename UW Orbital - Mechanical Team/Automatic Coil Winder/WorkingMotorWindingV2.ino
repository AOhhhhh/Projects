#include <ezButton.h>
#include <AccelStepper.h>

// Define the STEP and DIR pins for each Stepper Motor
#define stepPinLS 4 // Lead Screw Stepper
#define dirPinLS 5 

#define stepPinSR 2 // Spool roller Stepper
#define dirPinSR 3 

// Define the stepper motor and the pins that it's connected to
// Even though the Motors are technically 4 pin, we assume them as 2 Pin because of the Motor Driver Inputs (STEP and DIR)
AccelStepper stepper_SR(AccelStepper::FULL2WIRE, 2, 3);
AccelStepper stepper_LS(AccelStepper::FULL2WIRE, 4, 5);

ezButton limitSwitchRGT(6); // Right (Closer to the motor)
ezButton limitSwitchLFT(7); // Left (not close to the motor lol)
ezButton eStop(8); // On/off button + eStop

// Setting Lead Screw and Wire Diameter Variables
double leadScrew = 4; // in mm
double diameterWire = 0.3211; // in mm
double ratio = diameterWire/leadScrew;

long maxSteps = (3200)*(3679);

// For Stopping the Motor upon certain conditions
bool runMotor = true;

void setup() {

  Serial.begin(9600); //For Debugging

  limitSwitchLFT.setDebounceTime(50); // Limit switch delay times
  limitSwitchRGT.setDebounceTime(50);
  eStop.setDebounceTime(50);

  // You set the speed of the SR Motor
  float maxSpeed_SR = 400000.0;
  float accel_SR = 4000.0;
  int distance_SR = -73580000;
  
  stepper_SR.setMaxSpeed(maxSpeed_SR);
  stepper_SR.setAcceleration(accel_SR);
  stepper_SR.moveTo(distance_SR);

  float maxSpeed_LS = ratio*maxSpeed_SR;
  float accel_LS = ratio*accel_SR;
  int distance_LS = int(round(ratio*distance_SR));
//  int distance_LS = -4000;
  Serial.print(distance_LS);
  
  stepper_LS.setMaxSpeed(maxSpeed_LS);
  stepper_LS.setAcceleration(accel_LS);
  stepper_LS.moveTo(distance_LS);

  runMotor = true;
}

void loop() {
  eStop.loop();

  while(eStop.getState() == LOW && runMotor == true){
    eStop.loop();
    limitSwitchLFT.loop(); // Required declerations for limit switch states
    limitSwitchRGT.loop();

    if (limitSwitchRGT.getState() == HIGH){ 
      runMotor = false;
    }
  
    else if (limitSwitchLFT.getState() == HIGH){ 
      runMotor = false;  
    }
  
    else {
      runMotor = true;
    }
    
    stepper_SR.run();
    // The following command is for checking position, but if it's there I found it makes the motor slower
    // Probably because of a small delay when it's printing, so it's mainly there for testing
//    Serial.println(stepper_SR.currentPosition());

    stepper_LS.run();


  }
}
