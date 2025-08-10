from ultralytics import YOLO

model = YOLO("./weights/best.pt")
result = model.predict(source="./dataset/images/test/assembling-machine-2_0.83550115511753_1_nauvis_2913363151_27_0_30_3.jpg")
result[0].show()
