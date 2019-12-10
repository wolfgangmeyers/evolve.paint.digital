import * as React from "react";

export const Card: React.FC = props => {
    return (
        <div className="card border-primary mb-3">
            {props.children}
        </div>
    );
};
